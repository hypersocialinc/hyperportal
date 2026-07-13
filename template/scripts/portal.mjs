#!/usr/bin/env node
/**
 * portal — manage per-counterparty access links.
 *
 *   pnpm portal ls [--links]
 *   pnpm portal get-link "Acme Corp"
 *   pnpm portal add "Acme Corp" [--expires 2026-09-01] [--no-deploy]
 *   pnpm portal revoke "Acme Corp" [--delete] [--no-deploy]
 *   pnpm portal publish [--force]
 *
 * WHY THIS EXISTS, AND WHY IT REDEPLOYS
 *
 * Teams live in the PORTAL_TEAMS env var on Vercel. Per Vercel's docs:
 * "Any change you make to environment variables are not applied to previous
 * deployments, they only apply to new deployments."
 *
 * So editing the variable — in the dashboard or via `vercel env add` — does NOT
 * revoke a live link. The running deployment keeps honouring the old token until
 * something redeploys. A revoke that silently no-ops is worse than no revoke, so
 * every mutating command here redeploys production and then VERIFIES the link's
 * real HTTP status before claiming success.
 *
 * Consequence worth knowing: revocation is not instant. There is a window, equal
 * to the redeploy, in which a leaked link still works. If you ever need instant
 * revocation, teams must move out of env vars into a per-request store
 * (Edge Config / KV) and lib/access.ts must become async.
 *
 * `expires` is unaffected by all this: expired() is evaluated at request time
 * against a value already baked into the running deployment.
 *
 * WHY WE ASK THE SITE, NOT VERCEL
 *
 * `vercel redeploy <url>` rebuilds THAT deployment's source snapshot. If the
 * latest production deployment is behind origin/main — a push still building, a
 * failed build — then redeploying to apply an env change also rolls the room's
 * CONTENT back, silently. So every redeploy asserts the live commit matches
 * origin/main first.
 *
 * Vercel cannot answer "what commit is serving?" (`vercel inspect` reports no
 * sha, and Ready != aliased). So the app exposes it at /api/version, behind a
 * team cookie, and we ask the running site.
 */

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Load .env.local (gitignored) so a secret like POSTHOG_PERSONAL_API_KEY can live
// there instead of the shell. Anything already in the real env always wins.
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
} catch { /* no .env.local — fine */ }

const VAR = "PORTAL_TEAMS";
const ENVIRONMENT = "production";
// Production URL of this portal, e.g. https://portal.example.com. Set it in
// .env.local (PORTAL_URL=…) or the shell — every command that talks to the live
// site (probes, publish, links) needs it.
const RAW_BASE = process.env.PORTAL_URL ?? null;
function base() {
  if (!RAW_BASE) die("PORTAL_URL is not set. Add PORTAL_URL=https://<your-portal> to .env.local");
  return RAW_BASE.replace(/\/$/, "");
}
// Vercel team slug, if the project lives under a team rather than your personal
// scope. `redeploy <url>` in particular resolves URLs under the personal scope
// and fails for team projects — pin PORTAL_SCOPE in .env.local when that bites.
const SCOPE = process.env.PORTAL_SCOPE ?? null;

// PostHog (optional — only `stats` uses it): the room tags every $pageview and
// document_download with the "org" group (key = the counterparty name), so
// engagement is queryable per viewer. Set POSTHOG_PROJECT (project id) in
// .env.local to enable; POSTHOG_DASHBOARD (a dashboard id) is a nice-to-have.
const PH_HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
const PH_PROJECT = process.env.POSTHOG_PROJECT ?? null;
const PH_GROUP_TYPE = Number(process.env.POSTHOG_GROUP_TYPE ?? 0); // "org" group type index
const PH_DASHBOARD = process.env.POSTHOG_DASHBOARD ?? null;
/** PORTAL_DRY_RUN=1 — print what would change, touch nothing. */
const DRY = process.env.PORTAL_DRY_RUN === "1";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

function die(msg) {
  console.error(`\n  ${c.red("✗")} ${msg}\n`);
  process.exit(1);
}

function vercel(args, opts = {}) {
  const r = spawnSync("vercel", [...(SCOPE ? ["--scope", SCOPE] : []), ...args], {
    encoding: "utf8",
    input: opts.input,
    stdio: opts.inherit ? "inherit" : "pipe",
  });
  if (r.error) die(`could not run \`vercel\`: ${r.error.message}`);
  return r;
}

/** Pull PORTAL_TEAMS out of production. Returns [] if unset. */
function readTeams() {
  const dir = mkdtempSync(join(tmpdir(), "portal-"));
  const file = join(dir, "prod.env");
  try {
    const r = vercel(["env", "pull", file, `--environment=${ENVIRONMENT}`, "--yes"]);
    if (r.status !== 0) die(`vercel env pull failed:\n${r.stderr}`);
    const raw = readFileSync(file, "utf8");
    const m = raw.match(new RegExp(`^${VAR}=(.*)$`, "m"));
    if (!m) return [];
    let v = m[1].trim();
    // `vercel env pull` wraps the value in quotes but does NOT escape the inner
    // ones, so the line is `PORTAL_TEAMS="[{"token":…}]"`. Strip the wrapper
    // rather than JSON.parse it.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed)) die(`${VAR} is not a JSON array`);
    return parsed;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Overwrite PORTAL_TEAMS. Serialising through JSON.stringify means we can never
 * emit the malformed JSON that hand-editing a dashboard textarea can — which
 * matters, because lib/access.ts fails CLOSED: a malformed value locks out every
 * counterparty at once. We still back the old value up first.
 */
function writeTeams(teams) {
  if (DRY) {
    console.log(c.yellow(`  [dry-run] would set ${VAR} to ${teams.length} team(s): ` +
      teams.map((t) => `${t.org}${t.active === false ? " (revoked)" : ""}`).join(", ")));
    return;
  }
  const backup = join(tmpdir(), `portal-teams-backup-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(readTeams(), null, 2));

  const value = JSON.stringify(teams);
  const r = vercel(["env", "add", VAR, ENVIRONMENT, "--force"], { input: value });
  if (r.status !== 0) {
    console.error(c.red(`\n  ${VAR} write FAILED. Access may be broken.`));
    console.error(`  Previous value saved at: ${backup}`);
    console.error(`  Restore with:  cat ${backup} | jq -c . | vercel env add ${VAR} ${ENVIRONMENT} --force\n`);
    die(r.stderr || "vercel env add failed");
  }
  rmSync(backup, { force: true });
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) die(`git ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

/** Any active token will do — /api/version only checks that one is valid. */
function anyActiveToken() {
  const t = readTeams().find((x) => x.active !== false);
  if (!t) die("no active team, so the live commit cannot be read from /api/version");
  return t.token;
}

/** What commit is actually serving the room right now? null if unreachable. */
async function liveSha() {
  try {
    const res = await fetch(`${base()}/api/version`, {
      headers: { cookie: `dp_access=${anyActiveToken()}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { sha } = await res.json();
    return sha ?? null;
  } catch {
    return null;
  }
}

/**
 * Refuse to redeploy a snapshot that is not origin/main: doing so would apply the
 * env change AND revert the room's content, reporting only the former.
 */
async function assertProdMatchesMain(force) {
  git(["fetch", "--quiet", "origin", "main"]);
  const main = git(["rev-parse", "origin/main"]);
  const live = await liveSha();

  if (!live) {
    if (force) return console.log(c.yellow("  ⚠ could not read the live commit — continuing (--force)"));
    die("could not read the live commit from /api/version.\n" +
        "    Deploy once so the endpoint exists, or re-run with --force.");
  }
  if (live !== main) {
    if (force) return console.log(c.yellow(`  ⚠ live ${live.slice(0, 7)} != origin/main ${main.slice(0, 7)} — continuing (--force)`));
    die(`production is serving ${c.bold(live.slice(0, 7))}, but origin/main is ${c.bold(main.slice(0, 7))}.\n\n` +
        `    Redeploying now would apply the env change AND roll the room's content\n` +
        `    back to ${live.slice(0, 7)}. Push or wait for the build first, then retry.\n\n` +
        `    Override with --force if you understand the consequence.`);
  }
  console.log(c.dim(`  live commit ${live.slice(0, 7)} matches origin/main`));
}

function latestProdDeployment() {
  const r = vercel(["ls", "--prod"]);
  if (r.status !== 0) die(`vercel ls --prod failed:\n${r.stderr}`);
  // Only ever redeploy a Ready deployment. An Error or Building row at the top
  // would otherwise be resurrected as production.
  const line = (r.stdout + r.stderr)
    .split("\n")
    .find((l) => /https:\/\/[^\s]+\.vercel\.app/.test(l) && /Ready/.test(l));
  if (!line) die("could not find a Ready production deployment to redeploy");
  return line.match(/https:\/\/[^\s]+\.vercel\.app/)[0];
}

async function redeploy(force = false) {
  if (DRY) return console.log(c.yellow("  [dry-run] would redeploy production"));
  await assertProdMatchesMain(force);
  const url = latestProdDeployment();
  process.stdout.write(`  ${c.dim("Redeploying production… (env changes do not apply to existing deployments)")}\n`);
  const r = vercel(["redeploy", url, "--target", "production"], { inherit: true });
  if (r.status !== 0) die("redeploy failed — the env var was changed but is NOT live yet");
}

/** Ask the live site what it thinks of a token. This is the only real proof. */
async function probe(token) {
  try {
    const res = await fetch(`${base()}/r/${token}`, { redirect: "manual" });
    return res.status;
  } catch (e) {
    return `unreachable (${e.message})`;
  }
}

const mask = (t) => `${t.slice(0, 4)}${"•".repeat(24)}`;
const linkFor = (t) => `${base()}/r/${t}`;

function findTeam(teams, org) {
  const hit = teams.filter((t) => t.org.toLowerCase() === org.toLowerCase());
  if (hit.length === 0) die(`no team named ${JSON.stringify(org)}. Run \`pnpm portal ls\`.`);
  if (hit.length > 1) die(`${hit.length} teams named ${JSON.stringify(org)} — fix PORTAL_TEAMS by hand.`);
  return hit[0];
}

function status(t) {
  if (t.active === false) return c.red("revoked");
  if (t.expires && Date.now() > Date.parse(t.expires)) return c.yellow("expired");
  return c.green("active");
}

/** A team's effective tier (mirrors lib/access.ts tierOf: invalid ⇒ 1). */
function tierOf(t) {
  return Number.isInteger(t.tier) && t.tier >= 1 ? t.tier : 1;
}

/** Parse a --tier value or a positional tier arg into an int ≥ 1, or die. */
function parseTier(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) die(`tier must be an integer ≥ 1, got ${JSON.stringify(raw)}`);
  return n;
}

/** The counterparty's event stream on PostHog (the /events tab, not the empty
 *  Profile notebook the bare group URL lands on). Defaults to a 24h window in the
 *  UI — widen the date dropdown there for sparse viewers. */
function phGroupUrl(org) {
  return `${PH_HOST}/project/${PH_PROJECT}/groups/${PH_GROUP_TYPE}/${encodeURIComponent(org)}/events`;
}

/** Run a HogQL query, or null if no personal API key is configured. */
async function phQuery(sql) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) return null;
  const res = await fetch(`${PH_HOST}/api/projects/${PH_PROJECT}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });
  if (!res.ok) die(`PostHog query failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).results ?? [];
}

/** Open a URL in the default browser. */
function openInBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawnSync(cmd, [url], { stdio: "ignore" });
}

// ─── commands ────────────────────────────────────────────────────────────────

function cmdLs(flags) {
  const teams = readTeams();
  if (!teams.length) return console.log("\n  No teams configured.\n");
  console.log();
  for (const t of teams) {
    const tok = flags.links ? linkFor(t.token) : mask(t.token);
    const exp = t.expires ? c.dim(`  expires ${t.expires}`) : "";
    const tier = c.dim(`T${tierOf(t)}`);
    console.log(`  ${c.bold(t.org.padEnd(20))} ${status(t).padEnd(18)} ${tier}  ${tok}${exp}`);
  }
  console.log(flags.links ? "" : c.dim("\n  Tokens masked. Use --links to print full links.\n"));
}

function cmdLink(org, flags) {
  const t = findTeam(readTeams(), org);
  if (t.active === false) console.log(c.yellow(`\n  Note: ${t.org} is revoked — this link should not work.`));
  const link = linkFor(t.token);
  console.log(`\n  ${c.bold(t.org)}\n\n    ${link}\n`);
  // --open previews the room as this recipient (sets their cookie in your browser).
  if (flags?.open) openInBrowser(link);
}

async function cmdAdd(org, flags) {
  const teams = readTeams();
  if (teams.some((t) => t.org.toLowerCase() === org.toLowerCase()))
    die(`a team named ${JSON.stringify(org)} already exists. Revoke it first, or pick another name.`);
  if (flags.expires && Number.isNaN(Date.parse(flags.expires)))
    die(`bad --expires date: ${flags.expires}`);
  const tier = flags.tier === undefined ? 1 : parseTier(flags.tier);

  const token = randomBytes(16).toString("hex");
  const entry = { token, org, active: true, ...(tier > 1 ? { tier } : {}), ...(flags.expires ? { expires: flags.expires } : {}) };

  console.log(`\n  Granting ${c.bold(org)}${tier > 1 ? ` at ${c.bold("tier " + tier)}` : ""}…`);
  writeTeams([...teams, entry]);
  if (!DRY) console.log(`  ${c.green("✓")} ${VAR} updated`);

  if (flags.deploy === false) {
    console.log(c.yellow(`\n  ⚠ NOT LIVE. Env changes only apply to new deployments.`));
    console.log(c.yellow(`    The link below will 403 until you run: vercel redeploy <prod-url>\n`));
  } else {
    await redeploy(flags.force);
    if (!DRY) {
      const code = await probe(token);
      const ok = code === 307 || code === 302;
      console.log(`  ${ok ? c.green("✓") : c.red("✗")} verified: GET /r/<token> → ${code}${ok ? "" : c.red("  (expected a redirect)")}`);
    }
  }

  console.log(`\n  Link to send to ${c.bold(org)}:\n\n    ${linkFor(token)}\n`);
  console.log(c.dim(`  Revoke with:  pnpm portal revoke ${JSON.stringify(org)}\n`));
}

const NO_KEY_HINT = c.dim(
  "  Inline summary: set POSTHOG_PERSONAL_API_KEY (a personal key with query\n  scope) in .env.local and re-run to see the numbers here in the terminal.\n"
);

async function cmdStats(org, flags) {
  const openIt = flags.noOpen !== true;
  const haveKey = !!process.env.POSTHOG_PERSONAL_API_KEY;

  // No org → the all-counterparties overview.
  if (!org) {
    const url = `${PH_HOST}/project/${PH_PROJECT}/dashboard/${PH_DASHBOARD}`;
    console.log(`\n  ${c.bold("All counterparties")}\n`);
    console.log(`  ${c.bold("Dashboard")} ${c.dim("(who read what, downloads, forwarding signals)")}:\n    ${url}\n`);
    if (openIt) openInBrowser(url);
    if (!haveKey) return console.log(NO_KEY_HINT);

    const [byOrg, bySection] = await Promise.all([
      // Alias must NOT be "org" — that collides with the org group type and
      // groups by the group relationship instead of the event property.
      phQuery(`SELECT properties.org AS counterparty, count() AS views, count(distinct person_id) AS people, max(timestamp) AS last
               FROM events WHERE event = '$pageview'
                 AND properties.org IS NOT NULL AND properties.org != ''
                 AND timestamp > now() - INTERVAL 90 DAY
               GROUP BY counterparty ORDER BY views DESC LIMIT 50`),
      phQuery(`SELECT if(properties.section = '/room', 'index', replaceOne(properties.section, '/room/', '')) AS section,
                      count() AS views, count(distinct person_id) AS people
               FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 90 DAY
               GROUP BY section ORDER BY views DESC LIMIT 40`),
    ]);
    if (byOrg?.length) {
      console.log(`  ${c.bold("By counterparty")} ${c.dim("(last 90 days)")}`);
      for (const [o, views, people, last] of byOrg)
        console.log(`    ${String(o || "—").padEnd(22)} ${String(views).padStart(4)} views  ${String(people).padStart(2)} ppl  ${c.dim(String(last).slice(0, 10))}`);
      console.log();
    } else console.log(c.dim("  No views recorded yet.\n"));
    if (bySection?.length) {
      console.log(`  ${c.bold("Top sections")} ${c.dim("(all viewers)")}`);
      for (const [section, views, people] of bySection)
        console.log(`    ${String(section || "index").padEnd(22)} ${String(views).padStart(4)} views  ${String(people).padStart(2)} ppl`);
      console.log();
    }
    return;
  }

  // Org given → that counterparty's stream + summary.
  const t = findTeam(readTeams(), org);
  const url = phGroupUrl(t.org);
  console.log(`\n  ${c.bold(t.org)} ${c.dim("· tier " + tierOf(t))}\n`);
  console.log(`  ${c.bold("Event stream")} ${c.dim("(widen the date range for sparse viewers)")}:\n    ${url}\n`);
  if (openIt) openInBrowser(url);
  if (!haveKey) return console.log(NO_KEY_HINT);

  const O = t.org.replace(/'/g, "''");
  const [sections, downloads] = await Promise.all([
    phQuery(`SELECT if(properties.section = '/room', 'index', replaceOne(properties.section, '/room/', '')) AS section,
                    count() AS views, count(distinct person_id) AS people, max(timestamp) AS last
             FROM events
             WHERE event = '$pageview' AND properties.org = '${O}'
               AND timestamp > now() - INTERVAL 90 DAY
             GROUP BY section ORDER BY views DESC LIMIT 40`),
    phQuery(`SELECT properties.doc_title AS doc, count() AS n, max(timestamp) AS last
             FROM events WHERE event = 'document_download' AND properties.org = '${O}'
             GROUP BY doc ORDER BY n DESC LIMIT 40`),
  ]);

  if (!sections?.length) {
    console.log(c.dim("  No section views recorded yet.\n"));
  } else {
    console.log(`  ${c.bold("Sections")} ${c.dim("(last 90 days)")}`);
    for (const [section, views, people, last] of sections)
      console.log(`    ${String(section || "index").padEnd(22)} ${String(views).padStart(4)} views  ${String(people).padStart(2)} ppl  ${c.dim(String(last).slice(0, 10))}`);
    console.log();
  }
  if (downloads?.length) {
    console.log(`  ${c.bold("Downloads")}`);
    for (const [doc, n, last] of downloads)
      console.log(`    ${String(doc || "—").padEnd(30)} ${String(n).padStart(3)}  ${c.dim(String(last).slice(0, 10))}`);
    console.log();
  }
}

async function cmdSetTier(org, tierArg, flags) {
  const tier = parseTier(tierArg);
  const teams = readTeams();
  const t = findTeam(teams, org);
  const from = tierOf(t);

  console.log(`\n  ${c.bold(t.org)}: tier ${from} → ${c.bold("tier " + tier)}…`);
  // Drop the field entirely at tier 1 so the stored shape stays minimal.
  const next = teams.map((x) =>
    x.token !== t.token
      ? x
      : (() => {
          const { tier: _drop, ...rest } = x;
          return tier > 1 ? { ...rest, tier } : rest;
        })()
  );
  writeTeams(next);
  if (!DRY) console.log(`  ${c.green("✓")} ${VAR} updated`);

  if (flags.deploy === false) {
    console.log(c.yellow(`\n  ⚠ NOT LIVE until a redeploy. Run: vercel redeploy <prod-url>\n`));
    return;
  }
  await redeploy(flags.force);
  if (DRY) return console.log();
  const code = await probe(t.token);
  const ok = code === 307 || code === 302;
  console.log(`  ${ok ? c.green("✓") : c.red("✗")} link live: GET /r/<token> → ${code}`);
  console.log(c.dim(`\n  Tier changes are section visibility, not link validity — spot-check a tier-gated section in the room.\n`));
}

async function cmdRevoke(org, flags) {
  const teams = readTeams();
  const t = findTeam(teams, org);

  console.log(`\n  Revoking ${c.bold(t.org)}…`);
  const next = flags.delete
    ? teams.filter((x) => x.token !== t.token)
    : teams.map((x) => (x.token === t.token ? { ...x, active: false } : x));
  writeTeams(next);
  if (!DRY) console.log(`  ${c.green("✓")} ${VAR} updated (${flags.delete ? "entry deleted" : "active: false"})`);

  if (flags.deploy === false) {
    console.log(c.yellow(`\n  ⚠ NOT YET IN EFFECT. The live link still works.`));
    console.log(c.yellow(`    Env changes only apply to new deployments. Run: vercel redeploy <prod-url>\n`));
    return;
  }

  await redeploy(flags.force);
  if (DRY) return console.log();
  const code = await probe(t.token);
  if (code === 403) {
    console.log(`  ${c.green("✓")} verified: GET /r/<token> → 403. Link is dead as of ${new Date().toISOString()}.\n`);
  } else {
    console.log(c.red(`  ✗ verify FAILED: GET /r/<token> → ${code}, expected 403.`));
    console.log(c.red(`    The link may still be live. Investigate before assuming access is cut.\n`));
    process.exitCode = 1;
  }
}

/**
 * Push, wait for the deployment of THAT commit to actually serve, then prove the
 * gate still works. The deploy is incidental; the verification is the point.
 */
async function cmdPublish(flags) {
  const dirty = git(["status", "--porcelain"]);
  if (dirty && !flags.force) die(`working tree is dirty:\n\n${dirty}\n\n    Commit or stash first.`);

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main" && !flags.force) die(`on branch ${c.bold(branch)}, not main. Use --force to publish anyway.`);

  git(["fetch", "--quiet", "origin", "main"]);
  const local = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", "origin/main"]);
  const behind = git(["rev-list", "--count", `HEAD..origin/main`]);
  if (Number(behind) > 0 && !flags.force)
    die(`local is ${behind} commit(s) behind origin/main. Pull first.`);

  if (DRY) return console.log(c.yellow(`\n  [dry-run] would publish ${local.slice(0, 7)}\n`));

  if (local !== remote) {
    console.log(`\n  Pushing ${c.bold(local.slice(0, 7))}…`);
    const r = spawnSync("git", ["push", "origin", "main"], { stdio: "inherit" });
    if (r.status !== 0) die("git push failed");
  } else {
    console.log(`\n  ${local.slice(0, 7)} already on origin/main — waiting for it to serve…`);
  }

  process.stdout.write(c.dim("  Waiting for the deployment to serve this commit"));
  const deadline = Date.now() + 10 * 60_000;
  let serving = null;
  while (Date.now() < deadline) {
    serving = await liveSha();
    if (serving === local) break;
    process.stdout.write(c.dim("."));
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log();
  if (serving !== local)
    die(`timed out. Production is serving ${serving ? serving.slice(0, 7) : "an unknown commit"}, expected ${local.slice(0, 7)}.`);
  console.log(`  ${c.green("✓")} serving ${c.bold(local.slice(0, 7))}`);

  // The gate is the room's only security property. Prove it on every publish.
  const gate = await fetch(`${base()}/room`, { redirect: "manual" }).then((r) => r.status).catch((e) => `unreachable (${e.message})`);
  const gated = gate === 200; // /room renders the "This room is private" page
  const body = gated ? await fetch(`${base()}/room`).then((r) => r.text()) : "";
  const locked = gated && /This room is private/.test(body);
  console.log(`  ${locked ? c.green("✓") : c.red("✗")} gate: GET /room with no cookie → ${locked ? "locked" : `${gate}, NOT LOCKED`}`);

  const token = anyActiveToken();
  const code = await probe(token);
  const ok = code === 307 || code === 302;
  console.log(`  ${ok ? c.green("✓") : c.red("✗")} link: GET /r/<token> → ${code}`);

  if (!locked || !ok) {
    console.log(c.red("\n  Published, but verification FAILED. Investigate before sharing.\n"));
    process.exitCode = 1;
  } else {
    console.log(`\n  ${c.green("Published and verified.")} ${base()}\n`);
  }
}

// ─── argv ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const cmd = argv[0];
const positional = argv.slice(1).filter((a) => !a.startsWith("--"));
const flags = {
  links: argv.includes("--links"),
  delete: argv.includes("--delete"),
  deploy: argv.includes("--no-deploy") ? false : true,
  expires: argv.includes("--expires") ? argv[argv.indexOf("--expires") + 1] : undefined,
  tier: argv.includes("--tier") ? argv[argv.indexOf("--tier") + 1] : undefined,
  open: argv.includes("--open"),
  noOpen: argv.includes("--no-open"),
  force: argv.includes("--force"),
};

const usage = `
  ${c.bold("portal")} — manage per-counterparty access links

    pnpm portal ls [--links]                 read-only — who has access, tier + tokens
    pnpm portal get-link "Acme Corp" [--open]  read-only — reprint one team's link
    pnpm portal stats ["Acme Corp"] [--no-open]  read-only — engagement; omit org for all
                                                 counterparties. Opens the dashboard by default.
    pnpm portal add "Acme Corp" [--tier N] [--expires YYYY-MM-DD] [--no-deploy]
    pnpm portal set-tier "Acme Corp" N       widen/narrow what sections they see
    pnpm portal revoke "Acme Corp" [--delete] [--no-deploy]
    pnpm portal publish [--force]

  add, set-tier, and revoke change access; all three redeploy production, because
  Vercel env changes do not apply to existing deployments — then verify. Tier
  gates section visibility (see lib/sections.ts minTier); tier 1 is the default
  curated room. publish ships committed content, not access.
`;

switch (cmd) {
  case "ls": cmdLs(flags); break;
  // "link" is the old name, kept as an undocumented alias for muscle memory.
  case "get-link":
  case "link": positional[0] ? cmdLink(positional[0], flags) : die("usage: pnpm portal get-link \"<Org>\" [--open]"); break;
  case "stats": await cmdStats(positional[0], flags); break;
  case "add": positional[0] ? await cmdAdd(positional[0], flags) : die("usage: pnpm portal add \"<Org>\" [--tier N]"); break;
  case "set-tier": positional[0] && positional[1] ? await cmdSetTier(positional[0], positional[1], flags) : die("usage: pnpm portal set-tier \"<Org>\" <N>"); break;
  case "revoke": positional[0] ? await cmdRevoke(positional[0], flags) : die("usage: pnpm portal revoke \"<Org>\""); break;
  case "publish": await cmdPublish(flags); break;
  default: console.log(usage); process.exit(cmd ? 1 : 0);
}
