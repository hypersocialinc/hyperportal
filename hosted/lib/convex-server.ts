import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type {
  RoomView,
  SectionView,
  AssetForDownload,
} from "./render-types";

// Server-side calls into Convex from the Next renderer. We reference functions by
// name via `anyApi` rather than the generated `api`, so the web app builds and
// typechecks WITHOUT a live Convex deployment (the generated files only appear
// after `npx convex dev`). The wire calls still hit the real functions at runtime.

function client(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the URL " +
        "it prints into .env.local (see TESTING.md).",
    );
  }
  return new ConvexHttpClient(url);
}

export async function getRoomByToken(token: string | undefined): Promise<
  (RoomView & { roomId: string }) | null
> {
  return client().query(anyApi.rooms.getRoomByToken, { token });
}

export async function getSectionContent(
  token: string | undefined,
  slug: string,
): Promise<(SectionView & { roomId: string }) | null> {
  return client().query(anyApi.rooms.getSectionContent, { token, slug });
}

export async function getAssetForDownload(
  token: string | undefined,
  docId: string,
): Promise<AssetForDownload | null> {
  return client().query(anyApi.rooms.getAssetForDownload, { token, docId });
}

type CaptureArgs = {
  roomId: string;
  org: string;
  type: "room_open" | "section_view" | "doc_download";
  slug?: string;
  docId?: string;
  selfName?: string;
  selfEmail?: string;
};

// Fire-and-forget capture — a failed event must never block a viewer.
export async function captureEvent(args: CaptureArgs): Promise<void> {
  try {
    await client().mutation(anyApi.events.capture, args);
  } catch {
    /* swallow: analytics is never a gate */
  }
}
