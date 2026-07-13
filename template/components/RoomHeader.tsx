"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareLink } from "@/components/ShareLink";
import { PORTAL } from "@/lib/portal.config";

/**
 * Sticky room header — one compact line, with a thin reading-progress bar
 * along its bottom edge.
 */
export function RoomHeader({ token, org }: { token?: string; org: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    function measure() {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-background/85 backdrop-blur-sm dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/room" className="shrink-0 text-base font-semibold tracking-tight">
          {PORTAL.name}{" "}
          <span className="hidden font-normal whitespace-nowrap text-zinc-400 sm:inline">
            / {PORTAL.label}
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <ThemeToggle />
          <span className="flex min-w-0 items-baseline gap-1 text-xs uppercase tracking-wide text-zinc-400">
            <span className="truncate">For {org}</span>
            <span className="shrink-0">· {PORTAL.confidentiality}</span>
          </span>
          {token && <ShareLink token={token} org={org} />}
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-accent transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
