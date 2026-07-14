const TONES = {
  note: "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50",
  info: "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40",
  warn: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
} as const;

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`not-prose my-6 rounded-lg border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-zinc-600 dark:text-zinc-300">{children}</div>
    </div>
  );
}
