// Single place to rebrand a portal. `hyperportal new` rewrites `name`; edit the
// rest by hand for your deployment. Nothing here is secret — secrets live in
// env vars (see lib/access.ts).
export const PORTAL = {
  /** Wordmark text in the header, footer, and <title>. */
  name: "Portal",
  /** What kind of portal this is — shown next to the wordmark and in metadata. */
  label: "Data Room",
  /** Confidentiality tag rendered in the header. */
  confidentiality: "Confidential",
  /** Contact for access questions — gate page and footer. */
  contactEmail: "owner@example.com",
  /** Canonical production URL. Used for metadata and gate-page copy. */
  url: "https://portal.example.com",
} as const;
