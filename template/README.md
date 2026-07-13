# portal-template

A private disclosure portal served as a Next.js app. Content in `content/*.mdx`;
section availability and tiers in `lib/sections.ts`; branding in
`lib/portal.config.ts`. Scaffolded by [`hyperportal new`](../bin/hyperportal); the
operating judgment lives in the hyperportal skill's references.

## Access model

**One link per counterparty**, not per person — the recipient team shares it
internally. `/r/<token>` validates, sets an HttpOnly cookie, and redirects to
`/room`, so the token leaves the address bar and never lands in history or a
referrer.

Recipients live in the `PORTAL_TEAMS` env var on Vercel. **Tokens never enter
git.** Manage them with the CLI, never by hand:

```
# read-only
pnpm portal ls                                    # who has access (tokens masked)
pnpm portal ls --links                            # ...with full links
pnpm portal get-link "Acme Corp"                  # reprint one team's link
pnpm portal stats ["Acme Corp"]                   # engagement (needs PostHog config)

# changes who has access — all redeploy and verify
pnpm portal add "Acme Corp" --expires 2026-09-01  # grant (default tier 1)
pnpm portal set-tier "Acme Corp" 2                # widen what they can see
pnpm portal revoke "Acme Corp"                    # revoke
```

Quote org names containing spaces. Matching is case-insensitive. `add` refuses
an org that already exists and `get-link` refuses one that doesn't, so reaching
for the wrong one can't rotate a link someone is already holding.

> **A dashboard edit does not revoke.** Vercel applies env changes only to *new*
> deployments, so the running deployment keeps honouring a deleted token until
> something redeploys. `add`, `set-tier`, and `revoke` redeploy production and
> then probe the live URL — refusing to report success unless `/r/<token>`
> really returns a redirect (grant) or `403` (revoke). Editing `PORTAL_TEAMS`
> in the dashboard gives you a revoke that silently does nothing.
>
> Consequence: **revocation is not instant** — it takes as long as a redeploy.
> If that ever matters, recipients must move to Edge Config/KV and
> `lib/access.ts` must become async.

Rehearse anything risky with `PORTAL_DRY_RUN=1 pnpm portal revoke "…"` — it
reads real production data and writes nothing.

`expires` is exempt from the redeploy problem: it's evaluated per request
against a value already baked into the deployment.

**Identification is a courtesy, never a gate.** PostHog groups every viewer
under their counterparty (the unit that always exists); if someone volunteers a
name in the modal, they're identified too. Nobody has to qualify who they are
to read the room. `robots: noindex`; the org — not a person — renders in the
footer.

## Tiers

Each recipient carries `tier` (default 1); each section carries `minTier` and
`belowTier`:

- `belowTier: "teaser"` — below-tier recipients see a greyed "on request" row.
- `belowTier: "hidden"` — below-tier recipients never learn the section exists.

Enforcement is server-side in three places (index, section page, document
stream); a UI hide is never the gate. The sample sections demonstrate all
modes — `financials` (T2 teaser) and `sensitive` (T2 hidden).

## Content rules

- **Only curated content.** This repo is recipient-visible material only.
- Each section in `lib/sections.ts` renders its matching `content/<slug>.mdx`.
- PDFs/binary docs: private Vercel Blob + `lib/documents.ts` manifest
  (`pnpm docs:add`); the app signs a short-lived URL per gated request.

## Two things that leak, and are easy to miss

**Blob paths are viewer-visible.** They render inside `<img src>`, and the
portal is multi-tenant — the same deployment serves every counterparty. A path
like `/acme/hero.png` cross-names one recipient to another. Keep the prefix
neutral, route images through `MEDIA` in `lib/media.ts`, and never inline a
blob URL in `content/`. `Figure` takes a `MEDIA` key rather than a `src`
precisely so this can't happen.

**The OG image is published, permanently.** Link unfurlers (Slack, iMessage,
LinkedIn) fetch `public/og.png` server-side and cache it on *their*
infrastructure — outside the token gate, and ignoring `robots: noindex`. Once
cached it cannot be retracted. The shipped `og.png` is a plain placeholder;
replace it with at most your wordmark and a "Confidential" line — no metrics,
no dates, no counterparty names, nothing recipient-specific. Keep it a static
file, not a `next/og` route, so no future edit can interpolate a recipient into
a permanently-cached image.

## Configuration

Branding: `lib/portal.config.ts`. Env (`.env.local` locally, Vercel in prod):

| Var | Required | What |
|---|---|---|
| `PORTAL_TEAMS` | prod | JSON array of recipients — managed by `pnpm portal`, never by hand |
| `PORTAL_URL` | for CLI | canonical production URL, e.g. `https://portal.example.com` |
| `PORTAL_SCOPE` | if team-scoped | Vercel team slug (redeploys fail without it on team projects) |
| `NEXT_PUBLIC_BLOB_BASE` | for images | public blob store base for `lib/media.ts` |
| `DOCS_BLOB_READ_WRITE_TOKEN` | for docs | private blob store token used by `pnpm docs:add` and the signed-URL route |
| `NEXT_PUBLIC_POSTHOG_KEY` | for analytics | PostHog project API key |
| `POSTHOG_PROJECT` / `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_DASHBOARD` | for `stats` | project id / personal query key / dashboard id |
| `RESEND_API_KEY` / `NOTIFY_TO` / `NOTIFY_FROM` | for entry alerts | see `lib/notify.ts` |

## Dev / deploy

```
pnpm dev                # local — you need a local token, see below
pnpm build              # verify before pushing
pnpm portal publish     # push main, wait until it serves, prove the gate
```

Locally there are no recipients unless you supply them — `parseTeams()` fails
closed, so `/room` will just bounce you to the gate. Give yourself one:

```
PORTAL_TEAMS='[{"token":"dev","org":"Local","active":true}]' pnpm dev
# then visit http://localhost:3000/r/dev
```

- **Never `vercel deploy` manually** — `main` is the single source-deploy path;
  branches/PRs get preview URLs automatically. (`pnpm portal` runs
  `vercel redeploy` on the *existing* production deployment, which rebuilds it
  with the new env vars and ships no new source. That is the one sanctioned
  exception, and it is why grants and revokes take effect at all.)
- Framework is pinned via `vercel.json` (`"framework": "nextjs"`) — do not
  remove; if the dashboard preset is wrong ("Other") the pin is what makes
  deployments serve.

Before sharing externally: run `hyperportal doctor`, then `pnpm portal ls` to
confirm exactly who has access and that no scratch token survives.
