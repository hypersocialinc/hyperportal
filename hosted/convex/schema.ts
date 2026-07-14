import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A section as stored in a published room version. Mirrors lib/access.ts Section.
const sectionValidator = v.object({
  slug: v.string(),
  number: v.string(),
  title: v.string(),
  description: v.string(),
  minTier: v.number(),
  belowTier: v.union(v.literal("teaser"), v.literal("hidden")),
  group: v.union(v.literal("top"), v.literal("main")),
});

// One section's MDX body, carried inside a version so publishes are atomic.
const contentValidator = v.object({
  slug: v.string(),
  source: v.string(),
});

// Per-room branding, replaces the single-tenant lib/portal.config.ts.
const brandingValidator = v.object({
  name: v.string(),
  label: v.string(),
  confidentiality: v.string(),
  contactEmail: v.string(),
  url: v.string(),
});

export default defineSchema({
  // A room is the unit an owner shares. Content is versioned; the room points at
  // the version currently being served.
  rooms: defineTable({
    slug: v.string(),
    branding: brandingValidator,
    customDomain: v.optional(v.string()),
    currentVersionId: v.optional(v.id("roomVersions")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  // An immutable content snapshot. `room.sync` writes a new one and repoints the
  // room, so a publish is atomic and rollback is just repointing.
  roomVersions: defineTable({
    roomId: v.id("rooms"),
    sections: v.array(sectionValidator),
    content: v.array(contentValidator),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),

  // One capability link per counterparty org. Token is the bearer secret; access
  // is resolved fail-closed against active/expires/tier (see lib/access.ts).
  recipients: defineTable({
    roomId: v.id("rooms"),
    org: v.string(),
    token: v.string(),
    tier: v.optional(v.number()),
    active: v.boolean(),
    expires: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_room", ["roomId"]),

  // Documents and media attached to a room. A doc inherits its section's tier;
  // bytes live in Convex storage (MVP) or R2 (heavy media), keyed by `storage`.
  assets: defineTable({
    roomId: v.id("rooms"),
    kind: v.union(v.literal("doc"), v.literal("media")),
    docId: v.string(), // stable, content-facing id referenced by MDX / section
    section: v.optional(v.string()),
    title: v.optional(v.string()),
    filename: v.optional(v.string()),
    contentType: v.string(),
    size: v.optional(v.string()),
    date: v.optional(v.string()),
    storage: v.union(v.literal("convex"), v.literal("r2")),
    storageId: v.optional(v.id("_storage")), // when storage === "convex"
    r2Key: v.optional(v.string()), // when storage === "r2"
    mediaKey: v.optional(v.string()), // for media referenced from MDX
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_doc", ["roomId", "docId"])
    .index("by_room_section", ["roomId", "section"]),

  // Engagement. Captured server-side against the org (and person, if volunteered).
  // Convex subscriptions turn this into a live dashboard for free.
  events: defineTable({
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
    ts: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_ts", ["roomId", "ts"]),
});
