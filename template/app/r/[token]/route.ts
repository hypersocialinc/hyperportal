import { NextRequest, NextResponse } from "next/server";
import { teamForToken, ACCESS_COOKIE } from "@/lib/access";
import { notifyRoomOpened } from "@/lib/notify";
import { waitUntil } from "@vercel/functions";

// Team capability link: /r/<token> validates, sets the cookie, lands on /room.
// The token leaves the address bar on the redirect, so it does not sit in history
// or leak through a referrer header.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const team = teamForToken(token);
  if (!team) {
    return new NextResponse("This link is not active.", { status: 403 });
  }

  // Notify only on a genuinely new session. A viewer who already holds the cookie
  // is re-entering, not arriving — otherwise every refresh would send an email.
  const returning = req.cookies.get(ACCESS_COOKIE)?.value === token;
  if (!returning) waitUntil(notifyRoomOpened(team, req));

  const res = NextResponse.redirect(new URL("/room", req.url));
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    // WebKit drops Secure cookies on plain-http localhost, so require it only in prod.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
