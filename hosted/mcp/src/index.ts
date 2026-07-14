#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { adminQuery, adminMutation, BASE_URL } from "./convex.js";
import { syncRoom } from "./sync.js";

// The hyperportal operator control plane. Claude calls these tools to build and
// operate a data room; recipients never touch this — they get a plain web link.
// Auth is a single admin key held in this process's env, folded into every call.

const server = new McpServer({ name: "hyperportal", version: "0.1.0" });

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

const linkFor = (token: string) => `${BASE_URL.replace(/\/$/, "")}/r/${token}`;

server.tool(
  "room_create",
  "Create a new data room. Returns its roomId and slug.",
  {
    name: z.string().describe("Human name for the room, e.g. 'Acme Series A'"),
    contactEmail: z.string().optional(),
    url: z.string().optional().describe("Production URL for this room's branding"),
  },
  async (args) => {
    try {
      return ok(await adminMutation("rooms:createRoom", args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool("room_list", "List all rooms with recipient counts and publish state.", {}, async () => {
  try {
    return ok(await adminQuery("rooms:listRooms"));
  } catch (e) {
    return fail(e);
  }
});

server.tool(
  "room_sync",
  "Publish a local authoring directory (sections.json + content/*.mdx [+ documents.json]) as a new immutable version of a room.",
  {
    dir: z.string().describe("Absolute path to the room's authoring directory"),
    roomId: z.string().describe("Target roomId from room_create/room_list"),
  },
  async ({ dir, roomId }) => {
    try {
      return ok(await syncRoom(dir, roomId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "room_stats",
  "Engagement rollup for a room: opens, section views, and downloads per recipient org.",
  { roomId: z.string() },
  async ({ roomId }) => {
    try {
      return ok(await adminQuery("events:statsForRoom", { roomId }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "recipient_add",
  "Grant a counterparty org a private link to a room. Returns the link to send them.",
  {
    roomId: z.string(),
    org: z.string().describe("Counterparty organization name"),
    tier: z.number().int().min(1).optional().describe("Disclosure tier (default 1)"),
    expires: z.string().optional().describe("ISO date after which the link dies"),
  },
  async ({ roomId, org, tier, expires }) => {
    try {
      const { token } = (await adminMutation("recipients:addRecipient", {
        roomId,
        org,
        tier,
        expires,
      })) as { token: string };
      return ok({ org, link: linkFor(token) });
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "recipient_revoke",
  "Revoke a counterparty's link. Effective on their very next request — no redeploy.",
  { roomId: z.string(), org: z.string() },
  async ({ roomId, org }) => {
    try {
      return ok(await adminMutation("recipients:revokeRecipient", { roomId, org }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "recipient_set_tier",
  "Change a counterparty's disclosure tier (unlock more sections as trust grows).",
  { roomId: z.string(), org: z.string(), tier: z.number().int().min(1) },
  async ({ roomId, org, tier }) => {
    try {
      return ok(await adminMutation("recipients:setTier", { roomId, org, tier }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "recipient_list",
  "List a room's recipients with tier, active state, and their links.",
  { roomId: z.string() },
  async ({ roomId }) => {
    try {
      const rows = (await adminQuery("recipients:listRecipients", { roomId })) as {
        org: string;
        token: string;
        tier: number;
        active: boolean;
        expires: string | null;
      }[];
      return ok(
        rows.map((r) => ({
          org: r.org,
          tier: r.tier,
          active: r.active,
          expires: r.expires,
          link: linkFor(r.token),
        })),
      );
    } catch (e) {
      return fail(e);
    }
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  // stderr so it never corrupts the stdio protocol on stdout
  console.error("hyperportal MCP server ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
