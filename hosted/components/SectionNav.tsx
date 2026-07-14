import Link from "next/link";
import type { RoomView } from "@/lib/render-types";

const GROUPS: { id: "top" | "main"; label: string | null }[] = [
  { id: "top", label: null },
  { id: "main", label: "Materials" },
];

export function SectionNav({
  current,
  sections,
  contactEmail,
}: {
  current: string;
  sections: RoomView["sections"];
  contactEmail: string;
}) {
  return (
    <nav aria-label="Sections" className="text-sm">
      <Link
        href="/room"
        className="text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Index
      </Link>
      {GROUPS.map((g) => {
        const rows = sections.filter((s) => s.group === g.id);
        if (!rows.length) return null;
        return (
          <div key={g.id} className="mt-6">
            {g.label && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
                {g.label}
              </p>
            )}
            <ul className="space-y-1.5">
              {rows.map((s) => {
                const active = s.slug === current;
                if (!s.viewable) {
                  return (
                    <li key={s.slug} className="flex items-baseline gap-2 text-zinc-400 dark:text-zinc-600">
                      <span className="font-mono text-[10px] w-4 shrink-0">{s.number}</span>
                      <span className="leading-snug">{s.title}</span>
                    </li>
                  );
                }
                return (
                  <li key={s.slug} className="flex items-baseline gap-2">
                    <span className={`font-mono text-[10px] w-4 shrink-0 ${active ? "text-accent" : "text-zinc-400"}`}>
                      {s.number}
                    </span>
                    <Link
                      href={`/room/${s.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={`leading-snug transition-colors ${
                        active
                          ? "font-semibold text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                      }`}
                    >
                      {s.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="mt-8 text-xs text-zinc-400 leading-relaxed border-t border-zinc-200 dark:border-zinc-800 pt-4">
        Sections in grey open on request — usually same-day.
        <br />
        <a href={`mailto:${contactEmail}`} className="underline underline-offset-2 hover:text-zinc-600">
          {contactEmail}
        </a>
      </p>
    </nav>
  );
}
