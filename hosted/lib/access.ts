// Framework-agnostic access logic — the security core of the whole system.
//
// This file imports NOTHING from Convex, Next, or Node. That is deliberate:
//   - the Convex functions import it to enforce access server-side, and
//   - the Next renderer imports it to decide what to show,
// so both sides share ONE implementation of "who can see what", and it can be
// unit-tested in isolation (see access.test.ts).
//
// Everything here FAILS CLOSED. A malformed tier reads as 1 (the floor); an
// inactive or expired recipient resolves to null (no access); an unknown token
// resolves to null. Widening access is always explicit, never accidental.

/** A recipient organization holding one capability link into a room. */
export type Recipient = {
  org: string;
  token: string;
  active: boolean;
  /** Disclosure tier. Higher tiers see more sections. Absent/invalid ⇒ 1. */
  tier?: number;
  /** Optional ISO date. After this instant the link stops working. */
  expires?: string;
};

/** A section of a room and the rules for who may see it. */
export type Section = {
  slug: string;
  number: string;
  title: string;
  description: string;
  /** Recipient needs tier >= minTier to open this section's content. */
  minTier: number;
  /**
   * How the section renders to a recipient below minTier:
   *  - "teaser": a greyed "on request" row — the recipient knows it exists.
   *  - "hidden": omitted entirely — the recipient never learns it exists.
   */
  belowTier: "teaser" | "hidden";
  group: "top" | "main";
};

/** Self-reported, optional identity. Never required to read a room. */
export type SelfId = { name: string; email: string };

/** A recipient's effective tier. Fail-closed: anything but a valid int ≥ 1 ⇒ 1. */
export function tierOf(recipient: Pick<Recipient, "tier">): number {
  return Number.isInteger(recipient.tier) && (recipient.tier as number) >= 1
    ? (recipient.tier as number)
    : 1;
}

/** Has this recipient's link passed its expiry? Missing/invalid dates never expire. */
export function expired(recipient: Pick<Recipient, "expires">, now: number): boolean {
  if (!recipient.expires) return false;
  const at = Date.parse(recipient.expires);
  return Number.isFinite(at) && now > at;
}

/**
 * Resolve a stored recipient to an effective grant, or null if it must not work.
 * `now` is passed in (not read from the clock) so the logic is deterministic and
 * testable. Callers on the server pass Date.now().
 */
export function resolveRecipient(
  recipient: Recipient | null | undefined,
  now: number
): { org: string; tier: number } | null {
  if (!recipient) return null;
  if (recipient.active === false) return null;
  if (expired(recipient, now)) return null;
  return { org: recipient.org, tier: tierOf(recipient) };
}

/** Can a recipient at `tier` open this section's content? */
export function canView(section: Section, tier: number): boolean {
  return tier >= section.minTier;
}

/** Should this section appear in the index/nav for `tier` (as link or teaser)? */
export function isListed(section: Section, tier: number): boolean {
  return canView(section, tier) || section.belowTier === "teaser";
}

/**
 * The sections a tier should receive, each annotated with whether it is openable.
 * Hidden below-tier sections are dropped entirely — a caller that only ever sends
 * this list can never leak the existence of a hidden section.
 */
export function presentSections(
  sections: Section[],
  tier: number
): (Section & { viewable: boolean })[] {
  return sections
    .filter((s) => isListed(s, tier))
    .map((s) => ({ ...s, viewable: canView(s, tier) }));
}

/** Parse a self-id cookie/payload, clamped and validated. Empty ⇒ null. */
export function parseSelfId(raw: string | undefined | null): SelfId | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SelfId>;
    if (typeof v?.name !== "string" && typeof v?.email !== "string") return null;
    const name = typeof v.name === "string" ? v.name.trim().slice(0, 80) : "";
    const email = typeof v.email === "string" ? v.email.trim().slice(0, 120) : "";
    return name || email ? { name, email } : null;
  } catch {
    return null;
  }
}

export const ACCESS_COOKIE = "hp_access";
export const WHOAMI_COOKIE = "hp_whoami";
