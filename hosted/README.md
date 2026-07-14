# hyperportal (hosted) — prototype

The agent-operated, hosted rebuild of hyperportal. Instead of scaffolding a
Next.js portal you deploy to your own Vercel, you author a data room as **local
MDX files** and Claude publishes + operates it against a **hosted backend** over
**MCP**. Recipients get a plain private web link — no accounts, no self-hosting.

See [`../docs/pivot-plan.md`](../docs/pivot-plan.md) for the full rationale and
[`TESTING.md`](TESTING.md) to run it.

## Architecture

```
LOCAL (you author)         BACKEND (hosted)              RECIPIENT
authoring/<room>/          convex/  — DB, auth, events    browser
  sections.json     ─MCP→  rooms · recipients · assets   /r/<token>
  content/*.mdx     sync   Convex storage (docs/images)   → cookie → /room
  documents.json           app/     — Next renderer  ────→ gated pages
                           mcp/     — operator tools
```

- **`convex/`** — schema + functions. Fail-closed access logic lives in
  `../lib/access.ts` (shared with the renderer, unit-tested).
- **`app/`** — Next.js recipient renderer: `/r/<token>` gate, `/room` index,
  `/room/<slug>` sections (MDX + component library), `/room/docs/<id>` gated
  streaming, `/dashboard` live engagement.
- **`mcp/`** — the MCP server: `room_create`, `room_sync`, `room_list`,
  `room_stats`, `recipient_add/revoke/set_tier/list`.
- **`authoring/`** — a demo room + one-command seed script.

## Layers of flexibility (from the plan)

- **v1 (here):** the agent composes rooms from a fixed component library +
  section/tier config. Covers ~90% of dataroom needs.
- **v2:** sandboxed custom components via compile-on-sync.
- **Escape hatch:** the original self-host template (`../template/`) for the rare
  room that needs arbitrary code.

## Status

Prototype. Recipient rooms, tiered disclosure, gated docs, live analytics, and
the MCP control plane all work end-to-end against a local Convex dev deployment.
Compile-on-sync, R2 heavy-media, multi-owner accounts, and deploy are next — see
`TESTING.md` → "What's real vs. stubbed".
