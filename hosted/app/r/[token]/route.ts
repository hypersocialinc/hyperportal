import { NextRequest, NextResponse } from "next/server";
import { getRoomByToken, captureEvent } from "@/lib/convex-server";
import { ACCESS_COOKIE } from "@/lib/access";

// Capability link: /r/<token> validates against Convex, sets an HttpOnly cookie,
// and redirects to /room. The token leaves the address bar on the redirect, so it
// does not sit in history or leak through a referrer header.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const room = await getRoomByToken(token);
  if (!room) {
    return new NextResponse("This link is not active.", { status: 403 });
  }

  // Only capture a genuinely new session, not every refresh of a held cookie.
  const returning = req.cookies.get(ACCESS_COOKIE)?.value === token;
  if (!returning) {
    await captureEvent({ roomId: room.roomId, org: room.org, type: "room_open" });
  }

  const res = NextResponse.redirect(new URL("/room", req.url));
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
