import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAdmin } from "./admin";

// Operator-facing recipient management. Every mutation redeploys nothing and
// probes nothing — because the room is served live from this same deployment, a
// revoke is effective on the recipient's very next request. No env-var/redeploy
// dance (that was the whole footgun of the self-hosted model).

function randomToken(): string {
  // 32 hex chars of crypto randomness. crypto.getRandomValues exists in the
  // Convex runtime.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const addRecipient = mutation({
  args: {
    adminKey: v.string(),
    roomId: v.id("rooms"),
    org: v.string(),
    tier: v.optional(v.number()),
    expires: v.optional(v.string()),
  },
  handler: async (ctx, { adminKey, roomId, org, tier, expires }) => {
    assertAdmin(adminKey);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("no such room");

    const dupe = await ctx.db
      .query("recipients")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (dupe.some((r) => r.org.toLowerCase() === org.toLowerCase() && r.active)) {
      throw new Error(`an active recipient named "${org}" already exists`);
    }

    const token = randomToken();
    await ctx.db.insert("recipients", {
      roomId,
      org,
      token,
      active: true,
      ...(tier && tier > 1 ? { tier } : {}),
      ...(expires ? { expires } : {}),
      createdAt: Date.now(),
    });
    return { token, org };
  },
});

async function findRecipient(
  ctx: { db: any },
  roomId: string,
  org: string,
) {
  const all = await ctx.db
    .query("recipients")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();
  const hit = all.filter(
    (r: any) => r.org.toLowerCase() === org.toLowerCase() && r.active,
  );
  if (hit.length === 0) throw new Error(`no active recipient named "${org}"`);
  if (hit.length > 1) throw new Error(`multiple active recipients named "${org}"`);
  return hit[0];
}

export const revokeRecipient = mutation({
  args: { adminKey: v.string(), roomId: v.id("rooms"), org: v.string() },
  handler: async (ctx, { adminKey, roomId, org }) => {
    assertAdmin(adminKey);
    const r = await findRecipient(ctx, roomId, org);
    await ctx.db.patch(r._id, { active: false });
    return { revoked: org };
  },
});

export const setTier = mutation({
  args: {
    adminKey: v.string(),
    roomId: v.id("rooms"),
    org: v.string(),
    tier: v.number(),
  },
  handler: async (ctx, { adminKey, roomId, org, tier }) => {
    assertAdmin(adminKey);
    if (!Number.isInteger(tier) || tier < 1) throw new Error("tier must be an integer ≥ 1");
    const r = await findRecipient(ctx, roomId, org);
    await ctx.db.patch(r._id, { tier });
    return { org, tier };
  },
});

export const listRecipients = query({
  args: { adminKey: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { adminKey, roomId }) => {
    assertAdmin(adminKey);
    const rows = await ctx.db
      .query("recipients")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return rows.map((r) => ({
      org: r.org,
      token: r.token,
      tier: r.tier ?? 1,
      active: r.active,
      expires: r.expires ?? null,
      createdAt: r.createdAt,
    }));
  },
});
