import { DocsNav } from "@/features/docs/components/docs-nav";
import { LandingFooter } from "@/features/landing/components/footer";
import { SiteHeader } from "@/features/landing/components/site-header";

// The docs: always dark like the landing page, a sidebar of pages, one page at a time.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-col bg-[#0b0f12] text-white">
      <SiteHeader current="docs" />
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-24 pb-20 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 lg:pt-28">
        <DocsNav />
        <main className="min-w-0">{children}</main>
      </div>
      <LandingFooter />
    </div>
  );
}
