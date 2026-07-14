# Hyperportal Pivot Plan: Self-Host Template → Agent-Operated Hosted Service

## The pivot in one sentence

Keep the wedge — **Claude Code authors the data room as local MDX "like code"** — but
replace *"you deploy it to your own Vercel"* with **a hosted, multi-tenant service that
Claude operates over MCP**. Local files stay the source of truth for content; the service
owns private hosting, binary storage, recipient links, and read-tracking.

This removes the exact friction that caps the current model (self-deploy + support tax),
keeps the agent-native differentiator, turns binary media (images/video/PSD) from a
problem into a feature, and — critically — makes the thing monetizable, because you host
the storage and analytics.

---

## The one hard constraint: MCP is the control plane, not the host

MCP is how an **agent** calls tools. **Recipients are browsers** — they cannot "open an
MCP server." So the recipient-facing room (gated page, cookie, asset streaming, tracking)
must be served by a normal web service you run. MCP is the operator's remote control for
that service, nothing more.

```
┌─────────────────────────┐        ┌──────────────────────────────┐        ┌───────────────┐
│  LOCAL (owner's machine) │        │  HOSTED BACKEND (you run it)  │        │  RECIPIENT     │
│  content/*.mdx           │        │  • multi-tenant renderer      │        │  browser       │
│  sections.json           │◀─MCP──▶│  • token gate + tiers         │◀─HTTPS▶│  /r/<token>    │
│  assets (img/video/psd)  │ sync/  │  • private blob store (R2)    │        │  (no MCP)      │
│  hyperportal.json        │ ops    │  • events / analytics         │        │                │
│  ← Claude Code edits here │        │  • REST API (MCP wraps this)  │        │                │
└─────────────────────────┘        └──────────────────────────────┘        └───────────────┘
```

Three layers, MCP is only the top edge:

1. **Local authoring kit** — the folder Claude edits. Source of truth for content.
2. **MCP server** — thin; wraps the backend REST API with an owner API key.
3. **Hosted backend** — the actual product: renders rooms, gates recipients, stores
   binaries, records engagement, serves recipient links at your domain.

---

## Where to host it

### Requirements
- Node runtime for the renderer (RSC/MDX with a fixed component map).
- **Private** object storage with gated delivery; must scale to GB-scale video/PSD.
- A database (rooms, recipients, tiers, events).
- Multi-tenant + custom domains for recipient links.
- Cost scales with **storage + egress** — egress is the danger with media.

### Options

| Option | Compute | Storage | DB | Verdict |
|---|---|---|---|---|
| **A. Vercel** | Vercel (Next SSR) | ⚠️ Vercel Blob (metered egress) | Neon/Supabase | Fastest to build, **but** Blob egress + function limits bite with video |
| **B. Cloudflare** | Workers (OpenNext) | ✅ **R2 (zero egress)** | D1 / Neon via Hyperdrive | Cost-optimal long-term; Next-on-Workers is more friction |
| **C. Container host** | Fly.io / Render / Railway | ✅ R2 / Backblaze B2 | Managed Postgres | No serverless limits (long streams, big files); some ops |
| **D. AWS** | ECS/Lambda + CloudFront | S3 (egress via CDN) | RDS/DynamoDB | Most control + enterprise creds; most ops, overkill for MVP |

### Recommendation (phased) — Convex-based

Convex is the house stack (art360 runs on it) and collapses the DB + API + auth logic +
scheduling + realtime into one system we already know. It is **not** an SSR renderer, so
the recipient-facing render stays Next.js on Vercel with Convex as its backend.

- **MVP → Vercel (renderer) + Convex (DB/API/auth/scheduling/realtime + light file
  storage) + PostHog (optional).**
  - Convex functions hold the fail-closed token/tier logic (the `access.ts` rules) and
    the room/recipient/event tables.
  - Convex file storage is fine for the **document + image tier** to start — simplest,
    one system, `ctx.storage.getUrl` for gated delivery.
  - Convex scheduler/actions run async jobs (thumbnail/preview/transcode) — same pattern
    as art360's `generate.ts` pipeline.
  - Convex subscriptions give the owner a **live engagement dashboard** for free.

- **Heavy media → Cloudflare R2.** Video and PSD are egress-heavy and large; keep the
  bytes on **R2 (zero egress)** and store only the key/metadata in Convex. Introduce
  this as soon as video/PSD is a real use case — which, per the product brief, is early.

- **Scale → optionally push the gate/delivery edge to Cloudflare Workers** if recipient
  traffic to media grows enough that Vercel egress/function limits hurt. Convex + R2 stay
  put; only the delivery edge moves.

- **Enterprise → BYO storage.** Let a customer point a room at their own S3/R2 bucket +
  custom domain. You run the gate and analytics; you never hold their bytes. Resolves the
  trust-inversion objection (see Risks).

**The firm call:** the **heavy-media tier lives on an egress-free store (R2/B2)** — never
a metered store. Convex storage is fine for documents/images at MVP scale.

### Gated delivery: the one nuance
Two ways to stream a private asset to a recipient:
1. **Short-lived signed R2 URL (~60s TTL)** handed to the browser → egress is free (from
   R2), URL exposed only briefly. Right default for most rooms; same posture as the
   template's current presign, but egress-free.
2. **Stream-through the app** → full control + no exposed URL, but egress flows through
   compute (costs money). Reserve for the most sensitive material and cap file size.

---

## What carries over vs. gets absorbed

The existing `template/` is not thrown away — most of it becomes the service's renderer.

| Today (single-tenant template) | Becomes (hosted service) |
|---|---|
| `app/room/[slug]/page.tsx`, `app/room/page.tsx` | Multi-tenant renderer: load content by `(roomId, slug)` from storage instead of `process.cwd()/content` |
| `app/room/docs/[id]/route.ts` (presign + stream) | Same logic, R2-backed, per-room; egress-free signed URL variant added |
| `app/r/[token]/route.ts` (cookie gate) | Same gate, token resolved against DB instead of `PORTAL_TEAMS` |
| `lib/access.ts` (fail-closed tiers/tokens) | Service auth module — same fail-closed rules, DB-backed |
| `lib/sections.ts` | Per-room config in DB, synced from the local `sections.json` |
| `lib/media.ts` (MEDIA map, no inline blob URLs) | Enforced centrally; `asset.add` returns keys, content can only reference keys |
| `scripts/portal.mjs` (add/revoke/stats CLI) | **MCP tools + REST API** |
| `bin/hyperportal new` (scaffolder) | `room.create` + local `init` that writes `hyperportal.json` pointing at the service |
| `bin/hyperportal doctor` | Server-side invariants + `room.verify` tool |
| Leak rules (static OG, media map) | Enforced by the service, not per-deploy discipline |

**Rendering approach: compile-on-sync (not render-per-request).** At `room.sync`, compile
the room's MDX (+ any custom components) into a bundle, server-render to HTML where
possible, and store the sanitized artifact per `roomVersion`. The shared renderer only
ever serves **pre-compiled, sanitized output** — it never eval's arbitrary tenant code in
the live request path. This is what makes it safe to widen what the agent can build
(see "Flexibility" below), and it's how Mintlify/Nextra operate.

---

## Flexibility: how much freedom does the agent keep?

The best property of the current template is that the agent structures the room **however
it likes**, because it's editing a real Next.js codebase. A shared multi-tenant renderer
**cannot execute arbitrary per-tenant React** — that's cross-tenant RCE/XSS. So this is
the one real tradeoff of the pivot. Handle it explicitly:

**Kept, fully:** section structure, count, ordering, narrative, copy, document placement,
tier/disclosure logic, all media placement, and theme (color, type, spacing, density via
tokens). Everything that matters for *organizing a dataroom* survives.

**Given up (naive version):** inventing brand-new executable React primitives on the fly.
The agent composes from a library instead of writing arbitrary JSX.

**How the freedom is bought back:**

1. **v1 — rich component library + theme tokens.** Ship a broad set (Figure, Gallery,
   FigureRow, DataTable, Chart, Callout, Timeline, Video, KPI, DocList, FAQ…). For
   datarooms this covers ~90% and *feels* open. The agent still owns layout, order, and
   composition.
2. **v2 — sandboxed custom components, compiled at sync time.** `mdx-bundler`-style
   per-room compilation to a stored bundle, rendered in an isolated context. Restores
   near-total component-level freedom without live eval in the shared process.
3. **Always — "eject to self-host."** The current MIT template stays as the escape hatch
   for the rare room that needs truly arbitrary code. Hosted = fast/safe/composable;
   self-host = unlimited. Two tiers of flexibility, one funnel.

The freedom actually surrendered is narrow — "arbitrary executable code running in our
shared server" — and compile-on-sync + a rich library recovers most of the feel.

---

## Data model (Convex tables, first cut)

```
owners        (email, apiKeyHash, plan)
rooms         (ownerId, slug, customDomain, currentVersionId)
roomVersions  (roomId, createdAt, sectionsManifest, compiledBundleId)  # compile-on-sync artifact
recipients    (roomId, org, token, tier, active, expires, createdAt)   .index by_token
assets        (roomId, storage: "convex"|"r2", ref, contentType, size, previewRef, mediaKey)
events        (roomId, recipientId?, org, type, selfId?, uaHash, ts)   .index by_room_ts
                type ∈ {room_open, section_view, doc_download}
```

- **Content source of truth = local files.** Server source of truth = access + analytics
  + stored/compiled artifacts. `room.sync` compiles a content bundle → new `roomVersion`.
- **Assets are polymorphic:** `storage: "convex"` (documents/images at MVP) or `"r2"`
  (heavy video/PSD). The renderer resolves both behind the same gated route.
- Fail-closed rules from `access.ts` (malformed → no access, invalid tier → 1, unknown
  token → 403, expired → dead) move verbatim into the Convex query that resolves a token.

---

## MCP tool surface (final)

Thin wrappers over the REST API, authed with a per-owner key held locally.

```
room.create(name)                         -> { roomId, url }
room.sync(localDir)                        -> { versionId, sectionsPushed, assetsPushed }
room.list()                                -> [{ roomId, slug, recipients, lastSync }]
room.verify(roomId)                        -> { checks: [...] }   # gate/leak invariants
room.stats(roomId, org?)                   -> engagement rollup

asset.add(localPath)                       -> { mediaKey, previewKey }
asset.list(roomId)                         -> [...]

recipient.add(roomId, org, tier?, expires?) -> { link }           # /r/<token>
recipient.setTier(roomId, org, tier)
recipient.revoke(roomId, org)              -> { verified: true }   # server-verified
recipient.link(roomId, org)                -> { link }
```

`recipient.revoke` returning `verified: true` is the marquee property, now trivially
true because the service owns the running deployment — no Vercel redeploy dance.

**Precedent in your own stack:** Hyperdecks already implements this exact shape
(`create_share` / `list_shares` / `set_share_enabled` / `deck_stats`) — hosted content
with MCP-managed recipient sharing and tracking. hyperportal-as-MCP is that pattern for
datarooms with tiers and rich media. Strong candidate to **share a backend** with it.

---

## Local authoring kit

```
my-room/
  hyperportal.json     # { roomId, serviceUrl }   (owner API key in env/keychain, not here)
  sections.json        # slug, title, minTier, belowTier, group
  content/*.mdx        # Claude authors from context + connectors
  assets/              # staged binaries; asset.add uploads them, content refs the key
```

Flow: Claude edits MDX/sections → `asset.add` uploads binaries → `room.sync` publishes →
`recipient.add "Acme"` returns a link. No Vercel, no git host, no CI.

---

## Phased build plan

**Phase 0 — Decisions + spikes (1 wk)**
- Confirm host (MVP: Vercel + Neon + R2 + PostHog).
- Spike: render a room from storage-by-roomId (not filesystem); R2 signed-URL streaming;
  one custom domain end-to-end.

**Phase 1 — Backend MVP (2–3 wks)**
- DB + REST API. Reuse Next renderer serving one hardcoded room by token from storage.
- Cookie gate + tiers DB-backed. R2 asset streaming. Events table (raw capture).

**Phase 2 — MCP + local sync (1–2 wks)**
- MCP server wrapping the API. `room.create/sync`, `asset.add`, `recipient.*`.
- End-to-end: "Claude builds a room locally and publishes it," link works.

**Phase 3 — Tracking + stats (1 wk)**
- `room.stats`, per-org rollups, PostHog (or own events UI). Server-verified revoke.

**Phase 4 — Rich media (2 wks)**
- Image inline, gated video player, PSD/large-file gated download.
- Async worker for thumbnails/previews/transcode (queue + R2).

**Phase 5 — Domains, billing, enterprise (2–3 wks)**
- Custom domains per room. Plans/metering. **BYO-bucket** (customer S3/R2). At-rest
  encryption + data-handling statement.

**Phase 6 — Keep the OSS funnel**
- Preserve the MIT template as credibility + the self-host escape hatch.
- "Eject to self-host" and "import to hosted" both supported.

---

## Monetization (now possible)

- **Free:** 1 room, small storage cap, basic tracking, hyperportal subdomain.
- **Pro:** multiple rooms/recipients, video, longer retention, custom domain.
- **Enterprise:** BYO storage bucket, SSO, audit export, SLA.

The OSS self-host template was uncharageable (free-tier infra covers a solo fundraise).
The hosted service is chargeable because **you** hold the storage + analytics.

---

## Risks & mitigations

1. **Trust inversion** — the old pitch was "no third party sees your docs"; now you host
   them. → Default hosted-easy for the 90%; **BYO-bucket + custom domain** for the
   sensitive verticals (M&A, legal, immigration); at-rest encryption as table stakes.
2. **Egress cost** — video/PSD bandwidth. → R2/B2 zero-egress store from day one; signed
   direct-from-R2 delivery as default.
3. **Security liability** — you now hold confidential documents. → Least-privilege signed
   URLs, no client-visible blob paths, encryption, and a SOC2 path when enterprise asks.
4. **You now run infra** — multi-tenant uptime, storage, security is a company, not a
   weekend repo. → Reuse the Hyperdecks backend/ops where possible; start on managed
   primitives (Neon, R2, Vercel) to keep ops light early.
5. **Competition (Papermark/DocSend)** — → lean on the wedge they don't have:
   agent-native authoring + operation, MDX-as-code structure, staged/tiered disclosure,
   and rich media beyond PDFs.

---

## Decisions

**Locked:**
- **Compute host (MVP): Vercel** for the recipient renderer. Reuse the existing Next
  template; swap content source from filesystem to compiled-artifact-by-roomVersion.
- **Backend: Convex, standalone (separate from Hyperdecks).** DB + API + auth logic +
  scheduling + realtime. Independent account system; reference Hyperdecks' share/tracking
  design but don't couple to it.
- **Storage: Convex for documents/images; R2 for the heavy-media (video/PSD) tier.**
- **Rendering: compile-on-sync**, so the shared renderer serves only pre-compiled,
  sanitized output — the safety basis for widening agent flexibility.

**Still open before Phase 1:**
- Own Convex events table vs. PostHog for analytics (Convex gives free real-time; PostHog
  gives funnels/retention out of the box — possibly both: Convex for live, PostHog for
  product analytics).
- Recipient delivery default for R2 assets: signed-R2-URL (egress-free, brief exposure)
  vs. stream-through (full control, metered egress) — likely a per-room policy.
- Size of the v1 component library (which marks ship first).
