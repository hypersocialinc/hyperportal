import { NextRequest, NextResponse } from "next/server";
import { getAssetForDownload, captureEvent } from "@/lib/convex-server";
import { parseSelfId, ACCESS_COOKIE, WHOAMI_COOKIE } from "@/lib/access";

// Gated document streaming. The token cookie is required; the doc inherits its
// section's tier (enforced in Convex). Below-tier ⇒ 404, never revealing the doc
// or its section exists. The stored bytes are streamed through this route so no
// storage URL is ever exposed to the client.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const asset = await getAssetForDownload(token, id);
  if (!asset) return new NextResponse("Not found.", { status: 404 });

  const self = parseSelfId(req.cookies.get(WHOAMI_COOKIE)?.value);
  await captureEvent({
    roomId: asset.roomId,
    org: asset.org,
    type: "doc_download",
    docId: id,
    ...(self?.name ? { selfName: self.name } : {}),
    ...(self?.email ? { selfEmail: self.email } : {}),
  });

  // MVP: Convex storage. (r2 assets would be signed from asset.r2Key here.)
  if (!asset.url) {
    return new NextResponse("Document temporarily unavailable.", { status: 502 });
  }
  const upstream = await fetch(asset.url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Document temporarily unavailable.", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `attachment; filename="${asset.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
