import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertAdmin } from "./admin";
import {
  resolveRecipient,
  presentSections,
  canView,
  type Section,
  type Recipient,
} from "../lib/access";

// ─── shared resolution (fail-closed) ─────────────────────────────────────────

// token → { room, version, org, tier } or null. Every recipient-facing query
// routes through here, so access is enforced in exactly one place.
async function resolveRoomForToken(ctx: QueryCtx, token: string | undefined) {
  if (!token) return null;
  const recipient = await ctx.db
    .query("recipients")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique()
    .catch(() => null);

  const grant = resolveRecipient(recipient as Recipient | null, Date.now());
  if (!recipient || !grant) return null;

  const room = await ctx.db.get(recipient.roomId);
  if (!room || !room.currentVersionId) return null;
  const version = await ctx.db.get(room.currentVersionId);
  if (!version) return null;

  return { room, version, org: grant.org, tier: grant.tier, recipient };
}

// ─── recipient-facing queries (token-gated, no admin key) ────────────────────

// Everything the room index/layout needs. Sections are already filtered to the
// tier — hidden below-tier sections are absent, so this response can never leak
// that a hidden section exists.
export const getRoomByToken = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const r = await resolveRoomForToken(ctx, token);
    if (!r) return null;
    return {
      roomId: r.room._id,
      slug: r.room.slug,
      branding: r.room.branding,
      org: r.org,
      tier: r.tier,
      sections: presentSections(r.version.sections as Section[], r.tier),
    };
  },
});

// One section's MDX + its documents, or null if the section is above tier or
// absent (indistinguishable on purpose — a below-tier viewer can't probe).
export const getSectionContent = query({
  args: { token: v.optional(v.string()), slug: v.string() },
  handler: async (ctx, { token, slug }) => {
    const r = await resolveRoomForToken(ctx, token);
    if (!r) return null;

    const section = (r.version.sections as Section[]).find((s) => s.slug === slug);
    if (!section || !canView(section, r.tier)) return null;

    const content = r.version.content.find((c) => c.slug === slug);
    if (!content) return null;

    const docs = await ctx.db
      .query("assets")
      .withIndex("by_room_section", (q) =>
        q.eq("roomId", r.room._id).eq("section", slug),
      )
      .collect();

    return {
      section,
      org: r.org,
      roomId: r.room._id,
      source: content.source,
      docs: docs
        .filter((d) => d.kind === "doc")
        .map((d) => ({
          docId: d.docId,
          title: d.title ?? d.filename ?? d.docId,
          date: d.date ?? null,
          size: d.size ?? null,
        })),
    };
  },
});

// Resolve a document for gated streaming: returns storage locators + the org to
// attribute the download to, or null if the viewer's tier can't reach it.
export const getAssetForDownload = query({
  args: { token: v.optional(v.string()), docId: v.string() },
  handler: async (ctx, { token, docId }) => {
    const r = await resolveRoomForToken(ctx, token);
    if (!r) return null;

    const asset = await ctx.db
      .query("assets")
      .withIndex("by_room_doc", (q) =>
        q.eq("roomId", r.room._id).eq("docId", docId),
      )
      .unique()
      .catch(() => null);
    if (!asset || !asset.section) return null;

    const section = (r.version.sections as Section[]).find(
      (s) => s.slug === asset.section,
    );
    if (!section || !canView(section, r.tier)) return null;

    const url = asset.storageId ? await ctx.storage.getUrl(asset.storageId) : null;
    return {
      org: r.org,
      roomId: r.room._id,
      contentType: asset.contentType,
      filename: asset.filename ?? `${docId}`,
      storage: asset.storage,
      url, // convex signed URL (MVP); for r2 the renderer signs from the key
      r2Key: asset.r2Key ?? null,
    };
  },
});

// ─── operator queries/mutations (admin key) ──────────────────────────────────

export const listRooms = query({
  args: { adminKey: v.string() },
  handler: async (ctx, { adminKey }) => {
    assertAdmin(adminKey);
    const rooms = await ctx.db.query("rooms").collect();
    return Promise.all(
      rooms.map(async (room) => {
        const recipients = await ctx.db
          .query("recipients")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();
        return {
          roomId: room._id,
          slug: room.slug,
          name: room.branding.name,
          recipients: recipients.length,
          published: !!room.currentVersionId,
          createdAt: room.createdAt,
        };
      }),
    );
  },
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "room";
}

export const createRoom = mutation({
  args: {
    adminKey: v.string(),
    name: v.string(),
    contactEmail: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, { adminKey, name, contactEmail, url }) => {
    assertAdmin(adminKey);
    let slug = slugify(name);
    // De-dupe slugs so two rooms never collide on the recipient path.
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
      .catch(() => "collision");
    if (existing) slug = `${slug}-${Math.floor(Date.now() % 100000)}`;

    const roomId = await ctx.db.insert("rooms", {
      slug,
      branding: {
        name,
        label: "Data Room",
        confidentiality: "Confidential",
        contactEmail: contactEmail ?? "owner@example.com",
        url: url ?? "https://portal.example.com",
      },
      createdAt: Date.now(),
    });
    return { roomId, slug };
  },
});

const sectionArg = v.object({
  slug: v.string(),
  number: v.string(),
  title: v.string(),
  description: v.string(),
  minTier: v.number(),
  belowTier: v.union(v.literal("teaser"), v.literal("hidden")),
  group: v.union(v.literal("top"), v.literal("main")),
});

// Publish a new immutable version and atomically repoint the room at it.
export const publishVersion = mutation({
  args: {
    adminKey: v.string(),
    roomId: v.id("rooms"),
    sections: v.array(sectionArg),
    content: v.array(v.object({ slug: v.string(), source: v.string() })),
    branding: v.optional(
      v.object({
        name: v.string(),
        label: v.string(),
        confidentiality: v.string(),
        contactEmail: v.string(),
        url: v.string(),
      }),
    ),
  },
  handler: async (ctx, { adminKey, roomId, sections, content, branding }) => {
    assertAdmin(adminKey);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("no such room");

    const versionId = await ctx.db.insert("roomVersions", {
      roomId,
      sections,
      content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(roomId, {
      currentVersionId: versionId,
      updatedAt: Date.now(),
      ...(branding ? { branding } : {}),
    });
    return { versionId, sections: sections.length };
  },
});

// ─── asset upload (Convex storage, MVP media/doc tier) ───────────────────────

export const generateUploadUrl = mutation({
  args: { adminKey: v.string() },
  handler: async (ctx, { adminKey }) => {
    assertAdmin(adminKey);
    return await ctx.storage.generateUploadUrl();
  },
});

export const storeAsset = mutation({
  args: {
    adminKey: v.string(),
    roomId: v.id("rooms"),
    kind: v.union(v.literal("doc"), v.literal("media")),
    docId: v.string(),
    section: v.optional(v.string()),
    title: v.optional(v.string()),
    filename: v.optional(v.string()),
    contentType: v.string(),
    size: v.optional(v.string()),
    date: v.optional(v.string()),
    storageId: v.id("_storage"),
    mediaKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminKey);
    // Replace an existing asset with the same content-facing id (idempotent sync).
    const prior = await ctx.db
      .query("assets")
      .withIndex("by_room_doc", (q) =>
        q.eq("roomId", args.roomId).eq("docId", args.docId),
      )
      .unique()
      .catch(() => null);
    if (prior) await ctx.db.delete(prior._id);

    const { adminKey, ...rest } = args;
    void adminKey;
    return await ctx.db.insert("assets", {
      ...rest,
      storage: "convex" as const,
      createdAt: Date.now(),
    });
  },
});
