import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAdmin } from "./admin";

// Engagement capture + rollup. Capture is called server-side by the renderer
// (from the /r gate, section pages, and doc route) with the org already resolved
// from the token — a recipient can't forge attribution because they never supply
// the org, only their token, which the renderer resolves first.

export const capture = mutation({
  args: {
    roomId: v.id("rooms"),
    org: v.string(),
    type: v.union(
      v.literal("room_open"),
      v.literal("section_view"),
      v.literal("doc_download"),
    ),
    slug: v.optional(v.string()),
    docId: v.optional(v.string()),
    selfName: v.optional(v.string()),
    selfEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", { ...args, ts: Date.now() });
  },
});

// Per-org rollup for `room.stats`. Small-N friendly: reads the room's events and
// aggregates in memory. Swap for an incremental counter table if volume grows.
export const statsForRoom = query({
  args: { adminKey: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { adminKey, roomId }) => {
    assertAdmin(adminKey);
    const events = await ctx.db
      .query("events")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const byOrg = new Map<
      string,
      { org: string; opens: number; sectionViews: number; downloads: number; lastSeen: number }
    >();
    for (const e of events) {
      const row =
        byOrg.get(e.org) ??
        { org: e.org, opens: 0, sectionViews: 0, downloads: 0, lastSeen: 0 };
      if (e.type === "room_open") row.opens++;
      if (e.type === "section_view") row.sectionViews++;
      if (e.type === "doc_download") row.downloads++;
      row.lastSeen = Math.max(row.lastSeen, e.ts);
      byOrg.set(e.org, row);
    }
    return {
      total: events.length,
      byOrg: Array.from(byOrg.values()).sort((a, b) => b.lastSeen - a.lastSeen),
    };
  },
});

// Live feed for the owner dashboard (Convex subscription → real-time).
export const recentEvents = query({
  args: { adminKey: v.string(), roomId: v.id("rooms"), limit: v.optional(v.number()) },
  handler: async (ctx, { adminKey, roomId, limit }) => {
    assertAdmin(adminKey);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_room_ts", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
    return rows.map((e) => ({
      type: e.type,
      org: e.org,
      slug: e.slug ?? null,
      docId: e.docId ?? null,
      self: e.selfName || e.selfEmail || null,
      ts: e.ts,
    }));
  },
});
