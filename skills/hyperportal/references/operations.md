# Operations

## The one fact that shapes everything

Per Vercel's docs: **env-var changes do not apply to existing deployments.**
The running deployment keeps honouring the `PORTAL_TEAMS` it was built with
until something redeploys.

Consequences:
- Editing `PORTAL_TEAMS` in the dashboard, or via `vercel env add`, gives you
  a revoke that **silently does nothing**. Worse than no revoke.
- Every mutating CLI command (`add`, `set-tier`, `revoke`) therefore:
  1. writes the env var (after backing up the old value),
  2. redeploys production (`vercel redeploy` on the existing deployment —
     env applied, **no new source**),
  3. **probes the live URL** and refuses to report success unless
     `/r/<token>` really returns a redirect (grant) or 403 (revoke).
- Revocation is not instant — it takes one redeploy. Accepted trade-off; if a
  portal ever needs instant cuts, recipients move to Edge Config/KV and
  `lib/access.ts` becomes async.
- `expires` is exempt: it's evaluated per request against the value already
  baked in, so expiry needs no redeploy.

## Redeploy safety: content rollback

`vercel redeploy <url>` rebuilds *that deployment's* source snapshot. If
production is behind `origin/main` (a push mid-build, a failed build), a
redeploy applies the env change **and silently rolls content back**. The CLI
guards this by asking the running site its commit (`/api/version`, behind the
gate — Vercel itself can't answer "what commit is serving?") and refusing to
redeploy on mismatch. `--force` overrides; understand the consequence first.

## Deploy discipline

- Push to `main` = production deploy (Vercel Git integration). **Never
  `vercel deploy` manually** — the CLI's `redeploy` is the one sanctioned
  exception, and only because that's how env changes go live.
- `pnpm portal publish` = push, poll `/api/version` until the exact commit
  serves, then prove the gate (bare `/room` locked, an active token redirects).
  The deploy is incidental; the verification is the point.
- `vercel.json` pins `"framework": "nextjs"`. If the dashboard preset is wrong
  ("Other"), the pin is the only thing making deployments serve. Don't remove.

## Rehearsal and recovery

- `PORTAL_DRY_RUN=1 pnpm portal <cmd>` reads real production state, writes
  nothing, prints what would change. Rehearse anything risky.
- `writeTeams` backs up the previous value to a temp file before overwriting
  and prints the restore command on failure. A malformed write fails closed
  (locks everyone out) rather than open — restore from the backup, don't
  hand-edit.

## Wiring a new portal (the `setup` steps, done by hand)

1. `vercel link` in the portal repo (team scope? set `PORTAL_SCOPE` in
   `.env.local` — `vercel redeploy` resolves URLs under the personal scope
   otherwise and fails).
2. Connect the Git repo for push-to-main deploys; confirm the framework
   preset or rely on the `vercel.json` pin.
3. `PORTAL_URL=https://…` in `.env.local` (the CLI probes need it).
4. Blob: one **public** store for imagery (`NEXT_PUBLIC_BLOB_BASE`), the
   private store for documents (`BLOB_READ_WRITE_TOKEN`, attached by Vercel).
5. PostHog (optional): `NEXT_PUBLIC_POSTHOG_KEY` for tracking; for
   `pnpm portal stats` also `POSTHOG_PROJECT` + `POSTHOG_PERSONAL_API_KEY`
   (query scope) + optionally `POSTHOG_DASHBOARD` in `.env.local`. Define an
   `org` group type; events group by counterparty name.
6. Entry alerts (optional): `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM`.
7. `hyperportal doctor --dir . --url https://…` before the first real link.

## Day-to-day

- `pnpm portal ls` before sharing externally: exactly who has access, no
  scratch tokens surviving.
- Tier bumps are rare and deliberate (post-LOI, post-screening): `set-tier`,
  then spot-check a gated section as that recipient (`get-link --open`).
- `pnpm portal stats "Org"` for per-counterparty engagement; omit the org for
  the overview. Sparse viewers: widen the PostHog date range.
