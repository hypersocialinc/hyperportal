"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import type { SelfId } from "@/lib/access";
import { PORTAL } from "@/lib/portal.config";

const DISMISSED_KEY = "dp_identify_dismissed";

/**
 * Shown once per browser, when someone opens the room on a new device and has not
 * told us who they are. Skippable — identification is a courtesy, never a gate.
 * Dismissal is remembered locally so nobody is asked twice.
 */
export function IdentifyModal({ initial, org }: { initial: SelfId | null; org: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setOpen(true);
  }, [initial]);

  function close() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !email.trim()) return;
    setBusy(true);
    const res = await fetch("/api/whoami", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    setBusy(false);
    if (!res.ok) return;
    if (email.trim()) {
      posthog.identify(email.trim(), { name: name.trim(), email: email.trim(), org });
    }
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 px-6 backdrop-blur-sm dark:bg-black/50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          {PORTAL.name} — {PORTAL.label}
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Who&rsquo;s viewing?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          So we know who to follow up with, and who to send updates to as
          sections open.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />

          <div className="flex items-center gap-3 pt-1.5">
            <button
              type="submit"
              disabled={busy || (!name.trim() && !email.trim())}
              className="rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "Entering…" : "Enter room"}
            </button>
            <button
              type="button"
              onClick={close}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
