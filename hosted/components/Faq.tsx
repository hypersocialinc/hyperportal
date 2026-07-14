export function FaqGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="not-prose mt-10 first:mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">{title}</h2>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
        {children}
      </div>
    </section>
  );
}

export function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="cursor-pointer list-none flex items-start gap-3 font-medium hover:text-zinc-600 dark:hover:text-zinc-300">
        <span className="text-zinc-300 dark:text-zinc-600 mt-0.5 shrink-0 transition-transform group-open:rotate-90">›</span>
        <span>{q}</span>
      </summary>
      <div className="pl-6 pt-3 text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-3">{children}</div>
    </details>
  );
}
