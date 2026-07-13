export type Section = {
  slug: string;
  number: string;
  title: string;
  description: string;
  /** Recipient needs tier >= minTier to view this section's content. */
  minTier: number;
  /**
   * How the section renders to a recipient below minTier:
   *  - "teaser": a greyed "on request" row — the recipient knows it exists.
   *  - "hidden": omitted entirely — the recipient never learns it exists.
   * Irrelevant when minTier is 1 (always viewable).
   */
  belowTier: "teaser" | "hidden";
  group: "top" | "main";
};

/** Can a recipient at `tier` open this section's content? */
export function canView(section: Section, tier: number): boolean {
  return tier >= section.minTier;
}

/** Should this section appear in nav/index for `tier` (as a link or a teaser)? */
export function isListed(section: Section, tier: number): boolean {
  return canView(section, tier) || section.belowTier === "teaser";
}

export const GROUPS: { id: "top" | "main"; label: string | null }[] = [
  { id: "top", label: null },
  { id: "main", label: "Materials" },
];

// Sample sections demonstrating every disclosure mode. Replace with your
// domain's sections (see the hyperportal skill's domain-recipes reference), and
// keep one rule: each section here needs a matching content/<slug>.mdx.
export const SECTIONS: Section[] = [
  { slug: "overview", number: "00", title: "Overview", description: "What this portal contains and how access works.", minTier: 1, belowTier: "teaser", group: "top" },

  { slug: "documents", number: "01", title: "Documents", description: "The core document set, available to every recipient.", minTier: 1, belowTier: "teaser", group: "main" },
  { slug: "financials", number: "02", title: "Financials", description: "Detailed figures — unlocked at stage 2.", minTier: 2, belowTier: "teaser", group: "main" },
  { slug: "sensitive", number: "03", title: "Sensitive Material", description: "Stage-2 material whose existence is itself sensitive.", minTier: 2, belowTier: "hidden", group: "main" },
];
