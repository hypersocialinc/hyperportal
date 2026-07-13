# Leaks — the trap list

Every item here was found the careful way in production. The theme: **the token
gate protects pages, but several byproducts of serving pages escape the gate.**

## 1. The OG image is published, permanently

Link unfurlers (Slack, iMessage, LinkedIn, mail gateways) fetch
`public/og.png` **server-side, without the cookie**, and cache it on *their*
infrastructure — outside the gate, ignoring `robots: noindex`. Once cached it
cannot be retracted.

Rules:
- Content: at most the wordmark, the portal label, and "Confidential". No
  metrics, dates, counterparty names, nothing recipient-specific.
- It stays a **static file**. Never a `next/og` dynamic route — a static file
  can't have a future edit interpolate a recipient name into a permanently
  cached image. `hyperportal doctor` checks both.

## 2. Blob paths cross-name recipients

The portal is multi-tenant: one deployment serves every counterparty. Image
URLs render inside `<img src>`, visible to anyone who opens devtools. A path
like `.../acme/hero.png` names one recipient to another.

Rules:
- Keep the blob prefix neutral (`/room`, `/assets`), never an org name.
- Never inline a blob URL in `content/*.mdx`. Content passes a `MEDIA` key;
  `Figure` resolves it via `lib/media.ts`. The indirection exists so a content
  edit *can't* introduce a leaky path.
- Review each asset itself before adding: no third-party branding, no
  recipient-specific mockups, no metadata in the filename
  (`q3-burn-rate-final.png` leaks from the path bar).

## 3. Tokens want to escape URLs

The `/r/<token>` hop exists to get the token **out** of the URL and into an
HttpOnly cookie before the user reaches content. Preserve that property:
- Never link to `/r/<token>` from inside the room, an email template you
  render, or analytics events.
- Never log tokens (CLI masks them; keep it that way) or paste full links into
  issues/chat. `pnpm portal ls` masks by default; `--links` is deliberate.
- Documents download through short-lived signed URLs minted per gated request
  — never store or render a long-lived blob URL for a private doc.

## 4. Entry notifications fire from robots

Corporate mail gateways (SafeLinks, Proofpoint, Mimecast) and chat unfurlers
fetch every emailed URL before a human clicks. Without filtering, the first
"Acme opened the room" alert is their spam scanner. `lib/notify.ts` filters
non-human user agents — keep the filter when touching notifications, and treat
"opened 0 seconds after send" with suspicion anyway.

## 5. Quieter channels to keep in mind

- **Filenames** of downloadable docs appear in the recipient's Downloads
  folder and download managers — name them neutrally.
- **PostHog events** include section paths and org names by design; that
  project is internal-only. Don't add event properties that would hurt if the
  analytics project were shared.
- **robots noindex is a request, not a gate.** It keeps search engines polite;
  it does nothing against a forwarded link. The gate is the cookie check.
- **Preview deployments**: PRs get preview URLs (`*.vercel.app`) that serve
  the same gate. Fine — but don't disable the gate "just for previews".
