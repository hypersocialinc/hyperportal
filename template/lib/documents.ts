export type RoomDoc = {
  id: string; // stable, content-facing — MDX and section pages reference this
  section: string; // section slug from lib/sections.ts
  title: string;
  date: string; // document date, YYYY-MM-DD
  filename: string;
  contentType: string;
  size: string; // human readable, shown in the list
  pathname: string; // private-blob pathname; the URL is signed server-side per request, never stored here
};

// Manifest is the single source of truth mapping content-facing IDs to storage.
// Files live in a PRIVATE Vercel Blob store; the route mints a short-lived signed
// URL per gated request. Nothing here is fetchable without the server signing it.
// A document inherits its section's minTier — put sensitive files in a tier-gated
// section, not behind a special-cased path.
// Add entries via `pnpm docs:add <file> --section <slug> --title "..."`.
export const DOCS: RoomDoc[] = [
  // Example entry (id must be unique; pathname must exist in the private store):
  // {
  //   id: "certificate-of-incorporation",
  //   section: "documents",
  //   title: "Certificate of Incorporation",
  //   date: "2020-08-03",
  //   filename: "certificate-of-incorporation.pdf",
  //   contentType: "application/pdf",
  //   size: "2.9 MB",
  //   pathname: "docs/certificate-of-incorporation/certificate-of-incorporation.pdf",
  // },
];

export function docById(id: string): RoomDoc | null {
  return DOCS.find((d) => d.id === id) ?? null;
}

export function docsForSection(section: string): RoomDoc[] {
  return DOCS.filter((d) => d.section === section);
}
