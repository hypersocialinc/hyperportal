import { NextRequest, NextResponse } from "next/server";
import { teamForToken, ACCESS_COOKIE } from "@/lib/access";

// What commit is actually serving this room?
//
// Vercel's CLI cannot tell us: `vercel inspect` reports no commit sha, and a
// deployment being "Ready" says nothing about which one the domain is aliased to.
// So we ask the running site. This is what `pnpm portal publish` polls, and what
// guards `revoke` against redeploying a stale snapshot.
//
// Gated behind a valid team cookie: a commit sha of a private repo is not much of
// a secret, but this room is confidential and nothing about it should be readable
// without a token.
export async function GET(req: NextRequest) {
  if (!teamForToken(req.cookies.get(ACCESS_COOKIE)?.value)) {
    return new NextResponse("Access required.", { status: 403 });
  }
  return NextResponse.json(
    {
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      env: process.env.VERCEL_ENV ?? "local",
    },
    { headers: { "cache-control": "no-store" } }
  );
}
