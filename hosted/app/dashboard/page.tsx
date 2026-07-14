"use client";

// Dev owner dashboard — a live view of room engagement via Convex subscriptions.
// The admin key is entered here and kept in localStorage for convenience; this is
// a LOCAL/dev surface, not the production owner-auth (that comes with real
// accounts). Queries validate the key server-side, so a wrong key just returns an
// error rather than data.
import { useEffect, useMemo, useState } from "react";
import {
  ConvexProvider,
  ConvexReactClient,
  useQuery,
} from "convex/react";
import { anyApi } from "convex/server";

function useConvexClient(): ConvexReactClient | null {
  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  }, []);
}

const REL = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(ts: number): string {
  const s = Math.round((ts - Date.now()) / 1000);
  if (Math.abs(s) < 60) return REL.format(s, "second");
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return REL.format(m, "minute");
  return REL.format(Math.round(m / 60), "hour");
}

function Live({ roomId, adminKey }: { roomId: string; adminKey: string }) {
  const stats = useQuery(anyApi.events.statsForRoom, { adminKey, roomId }) as
    | { total: number; byOrg: { org: string; opens: number; sectionViews: number; downloads: number; lastSeen: number }[] }
    | undefined;
  const events = useQuery(anyApi.events.recentEvents, { adminKey, roomId, limit: 40 }) as
    | { type: string; org: string; slug: string | null; docId: string | null; self: string | null; ts: number }[]
    | undefined;

  return (
    <div className="grid md:grid-cols-2 gap-8 mt-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
          By recipient {stats ? `· ${stats.total} events` : ""}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-2">Org</th>
                <th className="text-right py-2">Opens</th>
                <th className="text-right py-2">Views</th>
                <th className="text-right py-2">Downloads</th>
                <th className="text-right py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byOrg ?? []).map((r) => (
                <tr key={r.org} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-2 font-medium">{r.org}</td>
                  <td className="py-2 text-right tabular-nums">{r.opens}</td>
                  <td className="py-2 text-right tabular-nums">{r.sectionViews}</td>
                  <td className="py-2 text-right tabular-nums">{r.downloads}</td>
                  <td className="py-2 text-right text-zinc-400">{r.lastSeen ? ago(r.lastSeen) : "—"}</td>
                </tr>
              ))}
              {stats && stats.byOrg.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-zinc-400">No activity yet — open a recipient link.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Live feed</h2>
        <ul className="space-y-1.5 text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="text-zinc-400 w-16 shrink-0 text-xs">{ago(e.ts)}</span>
              <span className="font-medium">{e.org}</span>
              <span className="text-zinc-500">
                {e.type === "room_open" && "opened the room"}
                {e.type === "section_view" && `viewed ${e.slug}`}
                {e.type === "doc_download" && `downloaded ${e.docId}`}
                {e.self ? ` · ${e.self}` : ""}
              </span>
            </li>
          ))}
          {events && events.length === 0 && <li className="text-zinc-400">Waiting for events…</li>}
        </ul>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const client = useConvexClient();
  const [roomId, setRoomId] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRoomId(localStorage.getItem("hp_roomId") ?? "");
    setAdminKey(localStorage.getItem("hp_adminKey") ?? "");
  }, []);

  function connect() {
    localStorage.setItem("hp_roomId", roomId);
    localStorage.setItem("hp_adminKey", adminKey);
    setReady(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Engagement</h1>
      <p className="text-sm text-zinc-500 mt-1">Live, via Convex subscriptions.</p>

      <div className="mt-6 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-xs text-zinc-400 mb-1">roomId</span>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-transparent w-72" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-zinc-400 mb-1">admin key</span>
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} type="password"
            className="border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-transparent w-56" />
        </label>
        <button onClick={connect}
          className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm hover:bg-indigo-500">
          Connect
        </button>
      </div>

      {!client && (
        <p className="mt-8 text-sm text-amber-600">NEXT_PUBLIC_CONVEX_URL is not set — start `npx convex dev`.</p>
      )}
      {client && ready && roomId && adminKey && (
        <ConvexProvider client={client}>
          <Live roomId={roomId} adminKey={adminKey} />
        </ConvexProvider>
      )}
    </div>
  );
}
