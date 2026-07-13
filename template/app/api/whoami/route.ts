import { NextRequest, NextResponse } from "next/server";
import { teamForToken, ACCESS_COOKIE, WHOAMI_COOKIE } from "@/lib/access";

// Optional self-identification. Never a gate: a viewer who skips this reads the
// whole room. Only callable from inside a valid team session.
export async function POST(req: NextRequest) {
  const team = teamForToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (!team) return new NextResponse("No session.", { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email =
    typeof body?.email === "string" ? body.email.trim().slice(0, 120) : "";

  if (!name && !email) return new NextResponse("Nothing to save.", { status: 400 });

  const res = NextResponse.json({ ok: true, name, email });
  res.cookies.set(WHOAMI_COOKIE, JSON.stringify({ name, email }), {
    httpOnly: false, // read by the client tracker to identify the person in PostHog
    // WebKit drops Secure cookies on plain-http localhost, so require it only in prod.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
