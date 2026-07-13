import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { teamForToken, tierOf, ACCESS_COOKIE } from "@/lib/access";
import fs from "node:fs";
import path from "node:path";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { SECTIONS, canView } from "@/lib/sections";
import { DocumentList } from "@/components/DocumentList";
import { Figure, FigureRow } from "@/components/Figure";
import { FaqGroup, Q } from "@/components/Faq";
import { SectionNav } from "@/components/SectionNav";

// Components usable from content/*.mdx. Add your domain's components here
// (charts, tables, galleries) — content can only reference what's in this map.
const mdxComponents = {
  Figure, FigureRow, FaqGroup, Q,
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const store = await cookies();
  const team = teamForToken(store.get(ACCESS_COOKIE)?.value);
  if (!team) notFound();
  const tier = tierOf(team);

  const { slug } = await params;
  // notFound (not a distinct 403) whether the section is above tier or absent —
  // a below-tier recipient must not be able to tell a hidden section exists.
  const section = SECTIONS.find((s) => s.slug === slug);
  if (!section || !canView(section, tier)) notFound();

  const file = path.join(process.cwd(), "content", `${slug}.mdx`);
  if (!fs.existsSync(file)) notFound();
  const source = fs.readFileSync(file, "utf8");

  const idx = SECTIONS.filter((s) => canView(s, tier));
  const pos = idx.findIndex((s) => s.slug === slug);
  const prev = pos > 0 ? idx[pos - 1] : null;
  const next = pos < idx.length - 1 ? idx[pos + 1] : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-14">
      <article className="max-w-3xl min-w-0">
        <Link
          href="/room"
          className="text-xs text-zinc-400 hover:text-zinc-600 lg:hidden"
        >
          ← Index
        </Link>
        <div className="prose prose-zinc dark:prose-invert prose-lg mt-5 lg:mt-0 max-w-none prose-headings:tracking-tight prose-p:leading-relaxed prose-li:leading-relaxed prose-li:my-1.5 prose-table:text-base prose-th:text-xs prose-th:uppercase prose-th:tracking-wide prose-th:text-zinc-400 prose-th:font-semibold prose-td:align-top">
          <MDXRemote
            source={source}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>
        <DocumentList section={slug} />

        <nav className="mt-16 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-4 text-sm">
          {prev ? (
            <Link href={`/room/${prev.slug}`} className="group max-w-[45%]">
              <span className="block text-xs text-zinc-400">← Previous</span>
              <span className="text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/room/${next.slug}`} className="group text-right max-w-[45%]">
              <span className="block text-xs text-zinc-400">Next →</span>
              <span className="text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50">
                {next.title}
              </span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
        <SectionNav current={slug} tier={tier} />
      </aside>
    </div>
  );
}
