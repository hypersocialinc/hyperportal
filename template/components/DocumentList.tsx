import { docsForSection } from "@/lib/documents";

export function DocumentList({ section }: { section: string }) {
  const docs = docsForSection(section);
  if (docs.length === 0) return null;

  return (
    <div className="mt-10 not-prose">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
        Documents
      </h3>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
        {docs.map((d) => (
          <li key={d.id}>
            <a
              href={`/room/docs/${d.id}`}
              className="flex items-baseline justify-between gap-4 py-3.5 px-1 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60 transition-colors"
            >
              <span className="font-medium">{d.title}</span>
              <span className="text-xs text-zinc-400 shrink-0">
                {d.date} · {d.size}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
