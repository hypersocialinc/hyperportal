import Link from "next/link";
import { cookies } from "next/headers";
import { getRoomByToken } from "@/lib/convex-server";
import { ACCESS_COOKIE } from "@/lib/access";
import type { RoomView } from "@/lib/render-types";

const GROUPS: { id: "top" | "main"; label: string | null }[] = [
  { id: "top", label: null },
  { id: "main", label: "Materials" },
];

type Row = RoomView["sections"][number];

function SectionRow({ s }: { s: Row }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-baseline gap-x-5 gap-y-1 py-5 md:grid-cols-[1.5rem_15rem_minmax(0,1fr)_auto]">
      <span className="font-mono text-xs text-zinc-400">{s.number}</span>
      {s.viewable ? (
        <Link href={`/room/${s.slug}`} className="font-medium underline-offset-4 hover:underline">
          {s.title}
        </Link>
      ) : (
        <span className="font-medium text-zinc-400">{s.title}</span>
      )}
      <p className="col-start-2 text-sm text-zinc-500 md:col-start-3">{s.description}</p>
      {!s.viewable && (
        <span className="col-start-2 justify-self-start rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-400 dark:border-zinc-700 md:col-start-4 md:justify-self-end">
          on request
        </span>
      )}
    </li>
  );
}

export default async function RoomIndex() {
  const store = await cookies();
  const room = await getRoomByToken(store.get(ACCESS_COOKIE)?.value);
  if (!room) return null; // the layout already renders the private notice

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight mb-3">{room.branding.label}</h1>
      <p className="mb-10 max-w-2xl text-zinc-500 dark:text-zinc-400">
        Sections marked &ldquo;on request&rdquo; expand as information requests arrive —
        expansions typically same-day.
      </p>
      {GROUPS.map((g) => {
        const rows = room.sections.filter((s) => s.group === g.id);
        if (rows.length === 0) return null;
        return (
          <div key={g.id} className="mb-8">
            {g.label && (
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1 mt-10">
                {g.label}
              </h2>
            )}
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((s) => (
                <SectionRow key={s.slug} s={s} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
