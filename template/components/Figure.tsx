/* eslint-disable @next/next/no-img-element */

import { MEDIA } from "@/lib/media";

// Content passes a MEDIA key, never a raw URL: blob paths are viewer-visible and
// the room is multi-tenant, so a hardcoded path in content/ can leak a
// counterparty name. See lib/media.ts.
export function Figure({
  media, alt, caption, phone,
}: { media: keyof typeof MEDIA; alt: string; caption?: string; phone?: boolean }) {
  return (
    <figure className={`not-prose my-8 ${phone ? "max-w-[280px]" : ""}`}>
      <img
        src={MEDIA[media]}
        alt={alt}
        className="w-full h-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800"
      />
      {caption && (
        <figcaption className="text-xs text-zinc-400 mt-2 leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function FigureRow({
  items, caption,
}: { items: { src: string; alt: string }[]; caption?: string }) {
  return (
    <figure className="not-prose my-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map((it) => (
          <img
            key={it.src}
            src={it.src}
            alt={it.alt}
            className="w-full h-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        ))}
      </div>
      {caption && (
        <figcaption className="text-xs text-zinc-400 mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}
