import Link from "next/link";

export function RoomHeader({
  name,
  label,
  confidentiality,
  org,
}: {
  name: string;
  label: string;
  confidentiality: string;
  org: string;
}) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/room" className="flex items-baseline gap-2">
          <span className="font-semibold tracking-tight">{name}</span>
          <span className="text-xs text-zinc-400">{label}</span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-amber-300/60 text-amber-600 dark:text-amber-400 px-2 py-0.5">
            {confidentiality}
          </span>
          <span className="text-zinc-400 hidden sm:inline">{org}</span>
        </div>
      </div>
    </header>
  );
}
