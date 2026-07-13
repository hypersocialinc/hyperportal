#!/usr/bin/env node
// Upload a document to the PRIVATE Vercel Blob store and print the manifest entry for lib/documents.ts.
// Usage: pnpm docs:add <file> --section <slug> --title "Cap Table Summary" [--date 2025-06-30] [--id custom-id]
// Requires DOCS_BLOB_READ_WRITE_TOKEN (vercel link && vercel env pull .env.local).

import { put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const file = args[0];
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
}

if (!file || !fs.existsSync(file)) {
  console.error("usage: pnpm docs:add <file> --section <slug> --title \"...\" [--date YYYY-MM-DD] [--id slug]");
  process.exit(1);
}

const filename = path.basename(file);
const section = opt("section", "");
const title = opt("title", filename);
const date = opt("date", new Date().toISOString().slice(0, 10));
const id = opt("id", filename.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-"));

const types = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const contentType = types[path.extname(filename).toLowerCase()] ?? "application/octet-stream";

const bytes = fs.statSync(file).size;
const size = bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;

const pathname = `docs/${id}/${filename}`;
await put(pathname, fs.readFileSync(file), {
  access: "private", // private store; served only via the gated /room/docs/[id] route, which signs a short-lived URL server-side
  contentType,
  token: process.env.DOCS_BLOB_READ_WRITE_TOKEN,
  allowOverwrite: true,
});

console.log("\nPaste into DOCS in lib/documents.ts:\n");
console.log(JSON.stringify({ id, section, title, date, filename, contentType, size, pathname }, null, 2) + ",");
