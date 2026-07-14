// Owner-side auth for the MVP: a single shared admin key, checked inside every
// mutation the operator (MCP server / sync script) calls. This is intentionally
// the simplest thing that fails closed — multi-owner accounts come later and slot
// in here without changing call sites.
//
// The key lives ONLY in the Convex deployment's env (HYPERPORTAL_ADMIN_KEY) and in
// the operator's local env. It is never sent to a recipient and never stored in a
// document. Read queries the recipient renderer uses are token-gated instead and
// do not require this key.

export function assertAdmin(key: string | undefined): void {
  const expected = process.env.HYPERPORTAL_ADMIN_KEY;
  if (!expected) {
    throw new Error(
      "HYPERPORTAL_ADMIN_KEY is not set on the Convex deployment. Run: " +
        "npx convex env set HYPERPORTAL_ADMIN_KEY <a-long-random-string>",
    );
  }
  if (!key || key !== expected) {
    throw new Error("unauthorized: bad or missing admin key");
  }
}
