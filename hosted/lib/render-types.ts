// Shapes returned by the Convex queries the renderer calls. Kept in sync by hand
// with convex/rooms.ts (the renderer talks to Convex over the wire via anyApi, so
// there's no generated type to import here). If you change a query's return shape,
// update the matching type below.
import type { Section } from "./access";

export type Branding = {
  name: string;
  label: string;
  confidentiality: string;
  contactEmail: string;
  url: string;
};

export type RoomView = {
  slug: string;
  branding: Branding;
  org: string;
  tier: number;
  sections: (Section & { viewable: boolean })[];
};

export type SectionDoc = {
  docId: string;
  title: string;
  date: string | null;
  size: string | null;
};

export type SectionView = {
  section: Section;
  org: string;
  source: string;
  docs: SectionDoc[];
};

export type AssetForDownload = {
  org: string;
  roomId: string;
  contentType: string;
  filename: string;
  storage: "convex" | "r2";
  url: string | null;
  r2Key: string | null;
};

export type TokenGrant = { roomId: string; org: string } | null;
