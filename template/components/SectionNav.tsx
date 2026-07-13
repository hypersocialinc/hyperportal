import Link from "next/link";
import { SECTIONS, GROUPS, canView, isListed } from "@/lib/sections";
import { PORTAL } from "@/lib/portal.config";

export function SectionNav({ current, tier }: { current: string; tier: number }) {
  return (
    <nav aria-label="Sections" className="text-sm">
      <div>
        <Link
          href="/room"
          className="text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Index
        </Link>

        {GROUPS.map((g) => {
          const rows = SECTIONS.filter(
            (s) => s.group === g.id && isListed(s, tier)
          );
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
                  if (!canView(s, tier)) {
                    return (
                      <li
                        key={s.slug}
                        className="flex items-baseline gap-2 text-zinc-400 dark:text-zinc-600"
                      >
                        <span className="font-mono text-[10px] w-4 shrink-0">
                          {s.number}
                        </span>
                        <span className="leading-snug">{s.title}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={s.slug} className="flex items-baseline gap-2">
                      <span
                        className={`font-mono text-[10px] w-4 shrink-0 ${
                          active ? "text-accent" : "text-zinc-400"
                        }`}
                      >
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
          <a
            href={`mailto:${PORTAL.contactEmail}`}
            className="hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2"
          >
            {PORTAL.contactEmail}
          </a>
        </p>
      </div>
    </nav>
  );
}
