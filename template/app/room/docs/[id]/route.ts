import { NextRequest, NextResponse } from "next/server";
import {
  teamForToken,
  tierOf,
  parseSelfId,
  ACCESS_COOKIE,
  WHOAMI_COOKIE,
} from "@/lib/access";
import { docById } from "@/lib/documents";
import { SECTIONS, canView } from "@/lib/sections";
import { issueSignedToken, presignUrl } from "@vercel/blob";

// Gated file streaming from a PRIVATE blob store: team cookie required. The file
// is private storage; this route mints a short-lived signed URL server-side and
// streams the bytes, so no blob URL (signed or otherwise) is ever exposed to the
// client, and nothing fetchable lives in the manifest/git.
// Every download is captured in PostHog against the team, and against the person
// if they self-identified.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const team = teamForToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (!team) {
    return new NextResponse("Access required.", { status: 403 });
  }
  const self = parseSelfId(req.cookies.get(WHOAMI_COOKIE)?.value);

  const { id } = await params;
  const doc = docById(id);
  if (!doc) return new NextResponse("Not found.", { status: 404 });

  // A document inherits its section's tier. Below-tier ⇒ 404, never revealing
  // that the document (or its section) exists.
  const section = SECTIONS.find((s) => s.slug === doc.section);
  if (!section || !canView(section, tierOf(team))) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    // fire-and-forget server-side capture; a failed event must never block a download
    fetch(
      `${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"}/capture/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event: "document_download",
          // Attribute to the person if they volunteered a name, else to the team.
          distinct_id: self?.email || `team:${team.org}`,
          properties: {
            doc_id: doc.id,
            doc_title: doc.title,
            org: team.org,
            viewer: self?.name ?? null,
            $groups: { org: team.org },
          },
        }),
      }
    ).catch(() => {});
  }

  // Mint a short-lived signed URL for the private blob, used server-side only.
  const signedToken = await issueSignedToken({
    pathname: doc.pathname,
    operations: ["get"],
    validUntil: Date.now() + 2 * 60 * 1000,
    token: process.env.DOCS_BLOB_READ_WRITE_TOKEN,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "get",
    pathname: doc.pathname,
    access: "private",
    validUntil: Date.now() + 60 * 1000,
  });

  const upstream = await fetch(presignedUrl);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Document temporarily unavailable.", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `attachment; filename="${doc.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
