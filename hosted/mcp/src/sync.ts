import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { adminMutation, uploadToConvexStorage } from "./convex.js";

// Reads a local authoring directory and publishes it as a new room version.
// Layout:
//   sections.json         [{ slug, number, title, description, minTier, belowTier, group }]
//   content/<slug>.mdx     one file per section
//   documents.json         (optional) [{ docId, section, title, filename, contentType, size?, date? }]
//   files/<filename>        (optional) the bytes referenced by documents.json
//   branding.json          (optional) { name, label, confidentiality, contactEmail, url }

type Section = {
  slug: string;
  number: string;
  title: string;
  description: string;
  minTier: number;
  belowTier: "teaser" | "hidden";
  group: "top" | "main";
};

export async function syncRoom(dir: string, roomId: string) {
  const sectionsPath = join(dir, "sections.json");
  if (!existsSync(sectionsPath)) {
    throw new Error(`no sections.json in ${dir}`);
  }
  const sections = JSON.parse(readFileSync(sectionsPath, "utf8")) as Section[];

  const content = sections.map((s) => {
    const file = join(dir, "content", `${s.slug}.mdx`);
    if (!existsSync(file)) throw new Error(`missing content/${s.slug}.mdx for section "${s.slug}"`);
    return { slug: s.slug, source: readFileSync(file, "utf8") };
  });

  const brandingPath = join(dir, "branding.json");
  const branding = existsSync(brandingPath)
    ? JSON.parse(readFileSync(brandingPath, "utf8"))
    : undefined;

  const published = await adminMutation("rooms:publishVersion", {
    roomId,
    sections,
    content,
    ...(branding ? { branding } : {}),
  });

  // Upload any documents listed in the manifest.
  const docsPath = join(dir, "documents.json");
  let uploaded = 0;
  if (existsSync(docsPath)) {
    const docs = JSON.parse(readFileSync(docsPath, "utf8")) as {
      docId: string;
      section: string;
      title: string;
      filename: string;
      contentType: string;
      size?: string;
      date?: string;
    }[];
    for (const d of docs) {
      const filePath = join(dir, "files", d.filename);
      if (!existsSync(filePath)) {
        throw new Error(`documents.json references files/${d.filename} which is missing`);
      }
      const bytes = new Uint8Array(readFileSync(filePath));
      const storageId = await uploadToConvexStorage(bytes, d.contentType);
      await adminMutation("rooms:storeAsset", {
        roomId,
        kind: "doc",
        docId: d.docId,
        section: d.section,
        title: d.title,
        filename: d.filename,
        contentType: d.contentType,
        size: d.size,
        date: d.date,
        storageId,
      });
      uploaded++;
    }
  }

  return { sections: sections.length, documents: uploaded, versionId: published.versionId };
}
