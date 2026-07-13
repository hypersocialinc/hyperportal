"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The room's URL (/room) is useless without the cookie, and the token is stripped
 * from the address bar on entry — so the URL a viewer would naturally copy hands a
 * colleague a locked door. Surface the real link, but make handing it over a
 * deliberate act rather than a silent clipboard write.
 *
 * The token is already in this viewer's possession; showing it grants nothing new.
 */
export function ShareLink({ token, org }: { token: string; org: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/r/${token}`);
  }, [token]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
      >
        Share internally
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[19rem] max-w-[calc(100vw-3rem)] rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Share inside {org}
          </p>

          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Anyone with this link can open the room — please don&rsquo;t forward it
            outside.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              {url}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-zinc-400">
            Copy this link — the one in your address bar won&rsquo;t work for others.
          </p>
        </div>
      )}
    </div>
  );
}
