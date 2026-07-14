export function KPIRow({ children }: { children: React.ReactNode }) {
  return <div className="not-prose my-8 grid grid-cols-2 sm:grid-cols-3 gap-4">{children}</div>;
}

export function KPI({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
