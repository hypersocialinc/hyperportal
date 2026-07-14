import { cookies } from "next/headers";
import { getRoomByToken } from "@/lib/convex-server";
import { ACCESS_COOKIE } from "@/lib/access";
import { RoomHeader } from "@/components/RoomHeader";

// Gate for everything under /room. A missing/invalid token shows the private
// notice (never the content, never a hint at what's inside).
export default async function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  const room = await getRoomByToken(token);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            This room is private.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            It opens from the invitation link, which looks like{" "}
            <code className="text-zinc-400">/r/…</code> — not from this address. If a
            colleague sent you <code className="text-zinc-400">/room</code>, ask them
            for the link they were sent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <RoomHeader
        name={room.branding.name}
        label={room.branding.label}
        confidentiality={room.branding.confidentiality}
        org={room.org}
      />
      <main className="mx-auto max-w-6xl px-6 py-12 w-full flex-1">{children}</main>
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>Prepared for {room.org}</span>
          <span>Questions: {room.branding.contactEmail}</span>
        </div>
      </footer>
    </div>
  );
}
