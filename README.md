# Hyperportal

**An open-source dataroom you build and manage with an AI coding agent**
(Claude Code, Codex, Cursor — anything that can run a CLI). You own the code,
the deployment, and the analytics.

**Website: [hyperportal.dev](https://hyperportal.dev)** — overview, use cases,
and the waitlist for the hosted version.

Share documents with investors, acquirers, landlords, or lawyers, and know
exactly what's happening:

- **One private link per recipient organization** — no accounts, no sign-up
  wall for your readers. Their team shares one link internally.
- **See who read what** — page views, document downloads, and engagement per
  recipient (PostHog, in your own project).
- **Revoke a link and it's actually dead** — the CLI verifies against the live
  site before reporting success, instead of trusting a dashboard edit.
- **Staged disclosure** — start everyone with the curated room, then unlock
  financials or sensitive sections per recipient as trust grows. Sections can
  show as "on request" or stay completely invisible until unlocked.
- **Content is just MDX in a git repo** — which is exactly why an agent can
  manage the whole thing: write sections, add documents, grant and revoke
  access, and read the engagement stats for you.

One codebase covers fundraising datarooms, M&A datarooms, rental applications,
and visa/green-card evidence binders — same machine, different content.
Extracted from a data room used in a real transaction; the operational
judgment here (what leaks, what silently fails) comes from production use.

## Quickstart

```bash
npx -y @hypersocial/hyperportal new acme-fundraise
cd acme-fundraise && pnpm install

# local dev with a throwaway token
PORTAL_TEAMS='[{"token":"dev","org":"Local","active":true}]' pnpm dev
# open http://localhost:3000/r/dev
```

Then edit `lib/sections.ts` and `content/*.mdx` for your domain, wire Vercel,
verify with `npx -y @hypersocial/hyperportal doctor --url https://…`, and grant
real links with `pnpm portal add "Org Name"`.

## Using with an AI agent (recommended)

Hyperportal ships as an agent skill. With it installed, Claude scaffolds the
portal, walks the disclosure design with you (who are the recipients, what
unlocks at which stage, what must never leak), and then operates it day-to-day —
granting links, revoking them, adding documents, pulling engagement stats:

```bash
npx skills add hypersocialinc/hyperportal   # or:
npx -y @hypersocial/hyperportal skill    # installs into ~/.claude/skills
```

Then just ask: *"build me a fundraising dataroom"*.

## What's in the box

| Part | What it is |
|---|---|
| [`template/`](template/) | A deployable Next.js portal: MDX sections, `/r/<token>` gate, tiers, `pnpm portal` CLI, PostHog analytics. Works out of the box with sample content. |
| [`bin/hyperportal`](bin/hyperportal) | Scaffolding CLI: `new` stamps a portal, `doctor` verifies one, `skill` installs the agent skill. |
| [`skills/hyperportal/`](skills/hyperportal/) | The Claude skill: workflow plus judgment — access model, leak traps, operations, per-domain recipes. |

## The model

- **One link per counterparty org** — `/r/<token>` sets an HttpOnly cookie and
  redirects, so tokens never live in history or referrers. Tokens live in an
  env var, never in git, managed only by a CLI whose every mutation redeploys
  **and probes the live URL** before reporting success.
- **Tiered disclosure** — each section has `minTier` and
  `belowTier: "teaser" | "hidden"`: below-tier recipients either see an
  "on request" row, or never learn the section exists. Enforced server-side.
- **Leak discipline** — images route through a media map so blob paths can't
  cross-name counterparties; the OG image is static and wordmark-only because
  unfurlers cache it forever, outside the gate.
- **Analytics as courtesy, not gate** — engagement is grouped per counterparty;
  nobody has to identify themselves to read.

See [`skills/hyperportal/references/`](skills/hyperportal/references/) for the
full write-ups — they double as documentation for humans.

## License

[MIT](LICENSE)
