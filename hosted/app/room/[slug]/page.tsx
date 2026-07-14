import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getRoomByToken, getSectionContent, captureEvent } from "@/lib/convex-server";
import { ACCESS_COOKIE } from "@/lib/access";
import { DocumentList } from "@/components/DocumentList";
import { SectionNav } from "@/components/SectionNav";
import { Figure, FigureRow } from "@/components/Figure";
import { FaqGroup, Q } from "@/components/Faq";
import { Callout } from "@/components/Callout";
import { DataTable } from "@/components/DataTable";
import { KPI, KPIRow } from "@/components/KPI";

// The component library content/*.mdx may reference. Content can only use what is
// in this map — a compromised content edit cannot pull in arbitrary components.
const mdxComponents = { Figure, FigureRow, FaqGroup, Q, Callout, DataTable, KPI, KPIRow };

export default async function SectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  const [room, section] = await Promise.all([
    getRoomByToken(token),
    getSectionContent(token, slug),
  ]);
  // notFound whether above-tier or absent — a below-tier viewer can't tell which.
  if (!room || !section) notFound();

  await captureEvent({
    roomId: section.roomId,
    org: section.org,
    type: "section_view",
    slug,
  });

  const viewable = room.sections.filter((s) => s.viewable);
  const pos = viewable.findIndex((s) => s.slug === slug);
  const prev = pos > 0 ? viewable[pos - 1] : null;
  const next = pos >= 0 && pos < viewable.length - 1 ? viewable[pos + 1] : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-14">
      <article className="max-w-3xl min-w-0">
        <Link href="/room" className="text-xs text-zinc-400 hover:text-zinc-600 lg:hidden">
          ← Index
        </Link>
        <div className="prose prose-zinc dark:prose-invert prose-lg mt-5 lg:mt-0 max-w-none prose-headings:tracking-tight">
          <MDXRemote
            source={section.source}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>
        <DocumentList docs={section.docs} />

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
        <SectionNav current={slug} sections={room.sections} contactEmail={room.branding.contactEmail} />
      </aside>
    </div>
  );
}
