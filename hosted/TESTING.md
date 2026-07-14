# Testing the hosted prototype

This is the agent-operated, Convex-backed rebuild of hyperportal. It runs three
pieces: a **Convex backend**, a **Next.js recipient renderer**, and an **MCP
server** that Claude uses to operate rooms. You author room content as local
files and publish them; recipients get a plain private web link.

Everything below has been verified except the steps that need YOUR Convex login
(noted inline). What I could check already passes:

- ✅ `pnpm test` — 26 access-logic unit tests (fail-closed tiers, hidden sections,
  token resolution, self-id parsing).
- ✅ `pnpm build` — the Next renderer compiles and typechecks with no live Convex.
- ✅ MCP server builds, boots, and lists all 8 tools over the MCP protocol.
- ⏳ End-to-end (publish → open room → see events) needs `npx convex dev`, which
  needs your Convex account. That's the part to drive when you wake up.

---

## 1. Start Convex (needs your login — ~2 min)

```bash
cd hosted
npx convex dev
```

- Log in / pick a project when prompted. Leave it running.
- It writes `CONVEX_DEPLOYMENT` to `.env.local` and prints your deployment URL
  (`https://<name>.convex.cloud`).

Now set the two env values:

```bash
cp .env.local.example .env.local   # if you don't already have one
# put the printed URL into NEXT_PUBLIC_CONVEX_URL in .env.local
# pick a long random string for HYPERPORTAL_ADMIN_KEY in .env.local, then:
npx convex env set HYPERPORTAL_ADMIN_KEY "<the-same-random-string>"
```

(The admin key must match in `.env.local` AND on the deployment — the seed script
uses the local one, the backend checks against the deployment one.)

## 2. Seed the demo room (one command)

```bash
node authoring/seed.mjs
```

This creates an "Acme Series A" room, publishes `authoring/demo-room/`, uploads
the sample document, and grants two recipients. It prints two links and a
`roomId`. Keep them.

## 3. Run the renderer

```bash
pnpm dev      # http://localhost:3000
```

Open the two links the seed printed:

- **Tier 1 (Beta Partners)** — sees Overview + Company Documents. Financials shows
  as a greyed **"on request"** row it can't open. Customer Contracts is **not
  visible at all** (hidden). Try forcing `/room/financials` and `/room/sensitive`
  in the URL — both 404 (server-enforced, not just hidden UI).
- **Tier 2 (Acme Capital)** — sees all four sections, opens everything, and the
  sample document downloads through the gated route.

Also try `http://localhost:3000/room` with no link → the private notice. A bogus
`/r/whatever` → 403.

## 4. Watch engagement live

Open `http://localhost:3000/dashboard`, paste the `roomId` and your admin key,
Connect. As you click around the recipient links in another tab, opens, section
views, and downloads appear in real time (Convex subscriptions). This is the
owner surface.

## 5. Operate it as Claude would (MCP)

Build once and point your MCP client at it:

```bash
cd mcp && pnpm install && pnpm build
```

MCP client config (Claude Code / Desktop):

```json
{
  "mcpServers": {
    "hyperportal": {
      "command": "node",
      "args": ["/home/user/hyperportal/hosted/mcp/dist/index.js"],
      "env": {
        "HYPERPORTAL_CONVEX_URL": "https://<name>.convex.cloud",
        "HYPERPORTAL_ADMIN_KEY": "<same-random-string>",
        "HYPERPORTAL_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then ask Claude things like:
- "list my hyperportal rooms"
- "grant Sequoia access to room `<roomId>` at tier 2"
- "revoke Beta Partners"
- "show engagement stats for room `<roomId>`"
- "sync `/home/user/hyperportal/hosted/authoring/demo-room` to room `<roomId>`"

A revoke is effective on the recipient's next request — no redeploy, because the
room is served live from the same backend.

---

## What's real vs. stubbed in this prototype

**Real:** multi-tenant rooms; token gate with HttpOnly cookie; fail-closed
tiers (teaser vs hidden) enforced server-side in the index, section page, and doc
stream; versioned publishes; gated document streaming from Convex storage;
server-side event capture attributed per org; live Convex dashboard; the full MCP
control plane; local MDX-as-code authoring + one-command publish.

**Deferred (documented in `docs/pivot-plan.md`):**
- **Compile-on-sync** rendering — v0 renders MDX per request with a fixed
  component library (Figure, Callout, DataTable, KPI, FAQ). The plan's compile
  step (for sandboxed custom components) is the next iteration.
- **R2 for heavy media** — v0 stores documents/images in Convex storage. Video/PSD
  belong on R2; the `assets` schema already carries a `storage: "convex" | "r2"`
  discriminator for it.
- **Multi-owner accounts** — v0 uses one shared admin key. Real per-owner auth
  slots into `convex/admin.ts` without changing call sites.
- **Event capture hardening** — `events.capture` currently trusts the org the
  renderer passes (the renderer resolves it from the token first). Before
  production, bind capture to the token server-side so it can't be forged.
- **Deploy** — this runs locally. Vercel (renderer) + Convex Cloud + R2 is the
  target; nothing here is deployed yet.
