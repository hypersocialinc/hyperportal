// Publicly-hosted, counterparty-neutral imagery only.
// RULE: never embed a counterparty's branding or name, or anything meant for one
// recipient — review every asset individually before adding it here.
//
// The blob PATH is part of every rendered <img src> and is visible to any viewer
// who opens devtools. The portal is multi-tenant — one link per counterparty, see
// lib/access.ts — so the path must never name a counterparty. Keep the prefix
// neutral, and never inline a blob URL directly in content/: route it through
// MEDIA so a leaky path can't slip in via a content edit (Figure takes a MEDIA
// key rather than a src precisely so this can't happen).
//
// Set NEXT_PUBLIC_BLOB_BASE to your public Vercel Blob store base, e.g.
//   NEXT_PUBLIC_BLOB_BASE=https://<store-id>.public.blob.vercel-storage.com/room
const BLOB = process.env.NEXT_PUBLIC_BLOB_BASE ?? "";

// Typed as Record<string, string> so the template compiles with no entries.
// Add entries like:
//   hero: `${BLOB}/hero.png`,
// and reference them from content as <Figure media="hero" alt="…" />.
export const MEDIA: Record<string, string> = {};

void BLOB; // referenced by the entries you add above
