---
name: hyperportal
description: Build and operate curated disclosure portals — datarooms, fundraising rooms, rental-application portals, visa/green-card evidence binders, or any site where one party shares staged documents with counterparties via per-org capability links, tiered access, real revocation, and read-analytics. Use when the user wants a "dataroom", "data portal", "disclosure portal", "document room", tokenized doc sharing with stages/tiers, or asks to scaffold/modify/operate a portal built from the hyperportal template (MDX + Vercel + PostHog).
---

# hyperportal

A **disclosure portal** is one party sharing curated, staged content and documents
with counterparties, with four properties email attachments lose: attribution
(who read what), revocation (that actually works), staged disclosure (more as
trust grows), and multi-tenancy that never cross-names recipients.

The machine ships as the `@hypersocial/hyperportal` npm package: a deployable
Next.js template plus a scaffolding CLI, both invoked via
`npx -y @hypersocial/hyperportal` — no install step. The references live
alongside this skill. **Read the reference file for whatever you're about to
touch — they carry production lessons, not boilerplate.**

| Doing what | Read first |
|---|---|
| Designing sections/tiers for a domain | `references/domain-recipes.md` |
| Anything with tokens, tiers, cookies | `references/access-model.md` |
| Adding images, docs, OG/meta, any URL a viewer sees | `references/leaks.md` |
| Granting/revoking/deploying/verifying | `references/operations.md` |
| Extending either CLI | `references/cli-design.md` |

## The model in one screen

- **One link per counterparty org** (`/r/<token>` → HttpOnly cookie → `/room`),
  not per person. Tokens live in the `PORTAL_TEAMS` env var — never in git,
  never managed by hand, only via `pnpm portal`.
- **Tiers**: each recipient has `tier` (default 1); each section has `minTier`
  and `belowTier: "teaser" | "hidden"`. Teaser = greyed "on request" row;
  hidden = the recipient never learns it exists. Enforced server-side in three
  places (index, section page, doc stream) — a UI hide is never the gate.
- **Everything fails closed**: malformed env → no access; invalid tier → 1;
  unknown token → 403.
- **Identification is a courtesy, never a gate.** Analytics group by the org;
  a person may volunteer their name.

## Workflow: new portal

1. **Scaffold** — `npx -y @hypersocial/hyperportal new <kebab-name> --dir <path>`,
   then `pnpm install`. This is a *working* portal; verify locally before
   customizing (step 4's probes) if anything seems off.
2. **Domain conversation** — before touching content, settle with the user:
   - Who are the counterparties (the unit a link is granted to)?
   - What do stages mean in this domain, and what unlocks at tier 2 (or 3)?
   - For each gated section: should a below-tier recipient *know it exists*
     (teaser) or not (hidden)? Hidden is for sections whose existence plants a
     question.
   - What must never leak — even via an image path, OG unfurl, or filename?
   Use `references/domain-recipes.md` for ready tier maps per domain.
3. **Customize** — `lib/portal.config.ts` (name, contact, prod URL),
   `lib/sections.ts`, `content/*.mdx`, domain components added to the
   `mdxComponents` map in `app/room/[slug]/page.tsx`. Images only via `MEDIA`
   keys; documents only via `pnpm docs:add` (private blob + manifest).
   Replace `public/og.png` with a wordmark-only static image.
4. **Verify locally** — seed `PORTAL_TEAMS` with a tier-1 and tier-2 token,
   `pnpm dev`, then curl-probe: valid token 307s, bogus 403s, bare `/room`
   shows the locked page, tier-1 gets 404 on gated slugs and never sees hidden
   sections in the index. `pnpm build` clean.
5. **Deploy** — create the Vercel project (`vercel link`; keep `vercel.json`'s
   framework pin), push to main, set `PORTAL_URL` in `.env.local`, attach the
   blob store, set PostHog vars if analytics wanted.
6. **Doctor, then grant** — `npx -y @hypersocial/hyperportal doctor --dir <path>
   --url https://…` must pass before any real link goes out. Then
   `pnpm portal add "Org"` — it
   redeploys and probes; trust its verification, not the dashboard.

## Workflow: operating an existing portal

Access changes only through `pnpm portal` (`ls` / `add` / `set-tier` /
`revoke` / `stats` / `publish`) — every mutation redeploys production and
probes the live URL before claiming success. **Never edit `PORTAL_TEAMS` in
the Vercel dashboard**: env edits don't apply to the running deployment, so a
dashboard "revoke" silently does nothing (`references/operations.md`).
Rehearse risky changes with `PORTAL_DRY_RUN=1`. Content ships via
`pnpm portal publish` (push, wait until serving, prove the gate).

## Non-negotiables (memorize these, details in leaks.md)

1. Never inline a blob/image URL in `content/` — `MEDIA` keys only. Blob paths
   render in `<img src>` and can cross-name counterparties.
2. `public/og.png` stays a static, wordmark-only file. Unfurlers cache it
   permanently, outside the gate. Never a `next/og` route.
3. Tokens never enter git, filenames, logs, or chat. The CLI masks them.
4. Every new content path must re-check access server-side; rendering less UI
   is not a gate.
