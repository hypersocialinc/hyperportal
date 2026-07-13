// Per-TEAM capability links. One link per counterparty, shared internally by them.
//
// Access is a team-level grant: /r/<token> -> HttpOnly cookie -> /room. Nobody has
// to qualify who they are. Identification is optional and self-reported (see
// WHOAMI_COOKIE) — a data point, never a gate.
//
// Teams are read from the PORTAL_TEAMS env var, so tokens never enter git.
//
//   PORTAL_TEAMS='[{"token":"<hex>","org":"Acme Corp","active":true}]'
//
// Manage with the CLI, never by hand:
//
//   pnpm portal ls
//   pnpm portal get-link "Acme Corp"
//   pnpm portal add "Acme Corp" [--tier N] [--expires 2026-09-01]
//   pnpm portal set-tier "Acme Corp" N
//   pnpm portal revoke "Acme Corp"
//
// A DASHBOARD EDIT DOES NOT REVOKE. Vercel applies env changes only to new
// deployments, so the running deployment keeps honouring a deleted token until
// something redeploys. `pnpm portal revoke` redeploys and then probes the live
// URL for a 403 before reporting success. Editing the variable by hand does not.
//
// "expires" is exempt: expired() is evaluated per request against a value already
// baked into the running deployment.

export type Team = {
  token: string;
  /** Counterparty name. Shown in the room footer and used as the PostHog group. */
  org: string;
  active: boolean;
  /**
   * Disclosure tier. Higher tiers see more sections (see lib/sections.ts minTier).
   * Absent or invalid ⇒ tier 1, the floor — access widening is always explicit.
   */
  tier?: number;
  /** Optional ISO date. After this, the link stops working. */
  expires?: string;
};

/** A team's effective tier. Fail-closed: anything but a valid int ≥ 1 reads as 1. */
export function tierOf(team: Team): number {
  return Number.isInteger(team.tier) && (team.tier as number) >= 1
    ? (team.tier as number)
    : 1;
}

/** Self-reported, optional. Never required to read the room. */
export type SelfId = { name: string; email: string };

export const ACCESS_COOKIE = "dp_access";
export const WHOAMI_COOKIE = "dp_whoami";

function parseTeams(): Team[] {
  const raw = process.env.PORTAL_TEAMS;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is Team =>
        !!t &&
        typeof (t as Team).token === "string" &&
        typeof (t as Team).org === "string"
    );
  } catch {
    // A malformed env var must fail closed, never open.
    return [];
  }
}

function expired(team: Team): boolean {
  if (!team.expires) return false;
  const at = Date.parse(team.expires);
  return Number.isFinite(at) && Date.now() > at;
}

export function teamForToken(token: string | undefined): Team | null {
  if (!token) return null;
  const team = parseTeams().find((t) => t.token === token);
  if (!team || team.active === false || expired(team)) return null;
  return team;
}

export function parseSelfId(raw: string | undefined): SelfId | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SelfId>;
    if (typeof v?.name !== "string" || typeof v?.email !== "string") return null;
    const name = v.name.trim().slice(0, 80);
    const email = v.email.trim().slice(0, 120);
    return name || email ? { name, email } : null;
  } catch {
    return null;
  }
}
