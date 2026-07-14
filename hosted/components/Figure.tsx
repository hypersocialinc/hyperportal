/* eslint-disable @next/next/no-img-element */

// v0: Figure takes a resolved src. In production this becomes a MEDIA-key lookup
// (see the pivot plan's leak-discipline section) so a content edit can't inline a
// counterparty-naming blob path. Kept simple here so the demo renders with no
// uploaded media.
export function Figure({
  src,
  alt,
  caption,
  phone,
}: {
  src: string;
  alt: string;
  caption?: string;
  phone?: boolean;
}) {
  return (
    <figure className={`not-prose my-8 ${phone ? "max-w-[280px]" : ""}`}>
      <img src={src} alt={alt} className="w-full h-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800" />
      {caption && <figcaption className="text-xs text-zinc-400 mt-2 leading-relaxed">{caption}</figcaption>}
    </figure>
  );
}

export function FigureRow({
  items,
  caption,
}: {
  items: { src: string; alt: string }[];
  caption?: string;
}) {
  return (
    <figure className="not-prose my-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map((it) => (
          <img key={it.src} src={it.src} alt={it.alt} className="w-full h-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800" />
        ))}
      </div>
      {caption && <figcaption className="text-xs text-zinc-400 mt-2">{caption}</figcaption>}
    </figure>
  );
}
