import { PORTAL } from "@/lib/portal.config";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-zinc-500">
        {PORTAL.name} — private. Access is by personal link.
      </p>
    </div>
  );
}
