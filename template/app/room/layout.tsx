import { cookies } from "next/headers";
import {
  teamForToken,
  parseSelfId,
  ACCESS_COOKIE,
  WHOAMI_COOKIE,
} from "@/lib/access";
import { PostHogTracker } from "@/components/PostHogTracker";
import { IdentifyModal } from "@/components/IdentifyModal";
import { RoomHeader } from "@/components/RoomHeader";
import { PORTAL } from "@/lib/portal.config";

export default async function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  const team = teamForToken(token);

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            This room is private.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            It opens from the invitation link, which looks like{" "}
            <code className="text-zinc-400">{new URL(PORTAL.url).host}/r/…</code> — not from
            this address. If a colleague sent you <code className="text-zinc-400">/room</code>,
            ask them for the link they were sent, or email{" "}
            <a href={`mailto:${PORTAL.contactEmail}`} className="underline underline-offset-2">
              {PORTAL.contactEmail}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const self = parseSelfId(store.get(WHOAMI_COOKIE)?.value);

  return (
    <div className="min-h-screen flex flex-col">
      <PostHogTracker org={team.org} self={self} />
      <IdentifyModal initial={self} org={team.org} />
      <RoomHeader token={token} org={team.org} />
      <main className="mx-auto max-w-6xl px-6 py-12 w-full flex-1">
        {children}
      </main>
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            Prepared for {team.org}
            {self?.name ? ` · ${self.name}` : ""}
          </span>
          <span>Questions: {PORTAL.contactEmail}</span>
        </div>
      </footer>
    </div>
  );
}
