// One-command demo seeder. After `npx convex dev` is running and env is set,
// run:  node authoring/seed.mjs
// It creates a room, publishes authoring/demo-room, uploads its sample document,
// and grants two recipients (tier 1 + tier 2), printing the links to open.
//
// Env (from .env.local or the shell):
//   NEXT_PUBLIC_CONVEX_URL  (or HYPERPORTAL_CONVEX_URL)
//   HYPERPORTAL_ADMIN_KEY
//   HYPERPORTAL_BASE_URL    (default http://localhost:3000)

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOM = join(HERE, "demo-room");

// Load .env.local if present (so you don't have to export vars by hand).
const envLocal = join(HERE, "..", ".env.local");
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}

const CONVEX_URL = process.env.HYPERPORTAL_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const ADMIN_KEY = process.env.HYPERPORTAL_ADMIN_KEY;
const BASE = (process.env.HYPERPORTAL_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

if (!CONVEX_URL) fail("Set NEXT_PUBLIC_CONVEX_URL (printed by `npx convex dev`).");
if (!ADMIN_KEY) fail("Set HYPERPORTAL_ADMIN_KEY (same value as `npx convex env set HYPERPORTAL_ADMIN_KEY …`).");

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);
const q = (name, args = {}) => convex.query(ref(name), { adminKey: ADMIN_KEY, ...args });
const m = (name, args = {}) => convex.mutation(ref(name), { adminKey: ADMIN_KEY, ...args });
function ref(name) {
  let r = anyApi;
  for (const p of name.split(/[.:]/)) r = r[p];
  return r;
}

async function uploadStorage(bytes, contentType) {
  const url = await m("rooms:generateUploadUrl");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": contentType }, body: bytes });
  if (!res.ok) throw new Error(`convex upload failed (${res.status})`);
  return (await res.json()).storageId;
}

async function main() {
  console.log("\n  Seeding demo room…");

  const branding = JSON.parse(readFileSync(join(ROOM, "branding.json"), "utf8"));
  const { roomId, slug } = await m("rooms:createRoom", {
    name: branding.name,
    contactEmail: branding.contactEmail,
    url: branding.url,
  });
  console.log(`  ✓ room created: ${slug} (${roomId})`);

  const sections = JSON.parse(readFileSync(join(ROOM, "sections.json"), "utf8"));
  const content = sections.map((s) => ({
    slug: s.slug,
    source: readFileSync(join(ROOM, "content", `${s.slug}.mdx`), "utf8"),
  }));
  await m("rooms:publishVersion", { roomId, sections, content, branding });
  console.log(`  ✓ published ${sections.length} sections`);

  const docs = JSON.parse(readFileSync(join(ROOM, "documents.json"), "utf8"));
  for (const d of docs) {
    const bytes = new Uint8Array(readFileSync(join(ROOM, "files", d.filename)));
    const storageId = await uploadStorage(bytes, d.contentType);
    await m("rooms:storeAsset", {
      roomId,
      kind: "doc",
      docId: d.docId,
      section: d.section,
      title: d.title,
      filename: d.filename,
      contentType: d.contentType,
      size: d.size,
      date: d.date,
      storageId,
    });
    console.log(`  ✓ uploaded document: ${d.title}`);
  }

  const beta = await m("recipients:addRecipient", { roomId, org: "Beta Partners" }); // tier 1
  const acme = await m("recipients:addRecipient", { roomId, org: "Acme Capital", tier: 2 });

  console.log(`\n  Open these to test the two disclosure tiers:\n`);
  console.log(`  Tier 1 (Beta Partners) — financials on-request, contracts hidden:`);
  console.log(`    ${BASE}/r/${beta.token}\n`);
  console.log(`  Tier 2 (Acme Capital) — sees everything:`);
  console.log(`    ${BASE}/r/${acme.token}\n`);
  console.log(`  roomId for MCP/stats: ${roomId}\n`);
}

main().catch((e) => fail(e.message));
