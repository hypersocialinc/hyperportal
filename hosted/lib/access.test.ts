import { describe, it, expect } from "vitest";
import {
  tierOf,
  expired,
  resolveRecipient,
  canView,
  isListed,
  presentSections,
  parseSelfId,
  type Section,
  type Recipient,
} from "./access";

const T0 = 1_700_000_000_000; // fixed "now" for determinism

const sections: Section[] = [
  { slug: "overview", number: "00", title: "Overview", description: "", minTier: 1, belowTier: "teaser", group: "top" },
  { slug: "financials", number: "01", title: "Financials", description: "", minTier: 2, belowTier: "teaser", group: "main" },
  { slug: "secret", number: "02", title: "Secret", description: "", minTier: 2, belowTier: "hidden", group: "main" },
];

describe("tierOf — fail closed to 1", () => {
  it("returns a valid tier", () => expect(tierOf({ tier: 3 })).toBe(3));
  it("floors missing tier to 1", () => expect(tierOf({})).toBe(1));
  it("floors zero/negative to 1", () => {
    expect(tierOf({ tier: 0 })).toBe(1);
    expect(tierOf({ tier: -5 })).toBe(1);
  });
  it("floors non-integers to 1", () => {
    expect(tierOf({ tier: 1.5 })).toBe(1);
    expect(tierOf({ tier: NaN })).toBe(1);
    // @ts-expect-error deliberately wrong type
    expect(tierOf({ tier: "2" })).toBe(1);
  });
});

describe("expired", () => {
  it("never expires without a date", () => expect(expired({}, T0)).toBe(false));
  it("expires after the instant", () => expect(expired({ expires: "2020-01-01" }, T0)).toBe(true));
  it("still valid before the instant", () => expect(expired({ expires: "2099-01-01" }, T0)).toBe(false));
  it("treats an unparseable date as non-expiring", () =>
    expect(expired({ expires: "not-a-date" }, T0)).toBe(false));
});

describe("resolveRecipient — fail closed", () => {
  const base: Recipient = { org: "Acme", token: "abc", active: true, tier: 2 };
  it("resolves an active recipient", () =>
    expect(resolveRecipient(base, T0)).toEqual({ org: "Acme", tier: 2 }));
  it("null for missing recipient", () => expect(resolveRecipient(null, T0)).toBeNull());
  it("null for inactive", () => expect(resolveRecipient({ ...base, active: false }, T0)).toBeNull());
  it("null for expired", () =>
    expect(resolveRecipient({ ...base, expires: "2020-01-01" }, T0)).toBeNull());
  it("floors a bad tier to 1 rather than failing", () =>
    expect(resolveRecipient({ ...base, tier: 0 }, T0)).toEqual({ org: "Acme", tier: 1 }));
});

describe("canView / isListed", () => {
  it("tier 1 can view a minTier-1 section", () => expect(canView(sections[0], 1)).toBe(true));
  it("tier 1 cannot view a minTier-2 section", () => expect(canView(sections[1], 1)).toBe(false));
  it("tier 2 can view a minTier-2 section", () => expect(canView(sections[1], 2)).toBe(true));
  it("a teaser section is listed below tier", () => expect(isListed(sections[1], 1)).toBe(true));
  it("a hidden section is NOT listed below tier", () => expect(isListed(sections[2], 1)).toBe(false));
  it("a hidden section IS listed at/above tier", () => expect(isListed(sections[2], 2)).toBe(true));
});

describe("presentSections — hidden sections never leak", () => {
  it("tier 1 sees overview (open) + financials (teaser) but NOT secret", () => {
    const out = presentSections(sections, 1);
    expect(out.map((s) => s.slug)).toEqual(["overview", "financials"]);
    expect(out.find((s) => s.slug === "overview")!.viewable).toBe(true);
    expect(out.find((s) => s.slug === "financials")!.viewable).toBe(false);
  });
  it("tier 2 sees all three, all viewable", () => {
    const out = presentSections(sections, 2);
    expect(out.map((s) => s.slug)).toEqual(["overview", "financials", "secret"]);
    expect(out.every((s) => s.viewable)).toBe(true);
  });
});

describe("parseSelfId", () => {
  it("parses name + email", () =>
    expect(parseSelfId('{"name":"Ada","email":"a@x.com"}')).toEqual({ name: "Ada", email: "a@x.com" }));
  it("null for empty/undefined", () => {
    expect(parseSelfId(undefined)).toBeNull();
    expect(parseSelfId("")).toBeNull();
    expect(parseSelfId("{}")).toBeNull();
  });
  it("null for malformed JSON", () => expect(parseSelfId("{not json")).toBeNull());
  it("clamps overly long values", () => {
    const out = parseSelfId(JSON.stringify({ name: "a".repeat(200), email: "b".repeat(200) }))!;
    expect(out.name.length).toBe(80);
    expect(out.email.length).toBe(120);
  });
  it("keeps name-only", () => expect(parseSelfId('{"name":"Ada"}')).toEqual({ name: "Ada", email: "" }));
});
