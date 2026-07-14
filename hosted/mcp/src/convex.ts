import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// Operator-side Convex access for the MCP server. Uses `anyApi` (name-based
// references) so this package needs no generated types from the app. The admin
// key is injected into every mutation from env — it never appears in a tool arg
// the model sees, so it can't leak into a transcript.

const CONVEX_URL = process.env.HYPERPORTAL_CONVEX_URL;
const ADMIN_KEY = process.env.HYPERPORTAL_ADMIN_KEY;
export const BASE_URL = process.env.HYPERPORTAL_BASE_URL ?? "http://localhost:3000";

export function env() {
  if (!CONVEX_URL) throw new Error("HYPERPORTAL_CONVEX_URL is not set");
  if (!ADMIN_KEY) throw new Error("HYPERPORTAL_ADMIN_KEY is not set");
  return { CONVEX_URL, ADMIN_KEY };
}

function client(): ConvexHttpClient {
  return new ConvexHttpClient(env().CONVEX_URL);
}

// Admin calls: fold in the admin key so callers never pass it.
export async function adminQuery(name: string, args: Record<string, unknown> = {}) {
  const ref = byName(anyApi, name);
  return client().query(ref, { adminKey: env().ADMIN_KEY, ...args });
}

export async function adminMutation(name: string, args: Record<string, unknown> = {}) {
  const ref = byName(anyApi, name);
  return client().mutation(ref, { adminKey: env().ADMIN_KEY, ...args });
}

// Resolve a dotted "module:function" or "module.function" name against anyApi.
function byName(root: unknown, name: string): any {
  const parts = name.split(/[.:]/);
  let ref: any = root;
  for (const p of parts) ref = ref[p];
  return ref;
}

// Upload a file's bytes to Convex storage and return its storageId.
export async function uploadToConvexStorage(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const uploadUrl = (await adminMutation("rooms:generateUploadUrl")) as string;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`convex upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
