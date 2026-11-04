import Link from "next/link";
import { GITHUB_REPO, GitHubMark } from "@/components/github-mark";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

// The public site's navbar (landing page and docs). Solid, not frosted: a blur over the
// moving hero would be recomputed every frame. Section links point at the landing page,
// so they work from the docs too.
export function SiteHeader({ current }: { current?: "docs" }) {
  const link = "rounded-md px-3 py-2 text-white/70 transition-colors hover:text-white";
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#0b0f12]/90">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Logo className="text-white" />
        <nav className="ms-auto flex items-center gap-0.5 text-sm sm:gap-1">
          <Link href="/#how" className={cn(link, "hidden md:block")}>
            How it works
          </Link>
          <Link href="/#features" className={cn(link, "hidden md:block")}>
            Features
          </Link>
          <Link
            href="/docs"
            aria-current={current === "docs" ? "page" : undefined}
            className={cn(link, current === "docs" && "text-white")}
          >
            Docs
          </Link>
          <Link href="/#demo" className={cn(link, "hidden sm:block")}>
            Try it
          </Link>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tollgate is open source: view it on GitHub"
            className="ms-1 inline-flex items-center gap-2 rounded-lg border border-white/15 px-2.5 py-2 text-white/80 transition-colors hover:border-white/30 hover:text-white sm:px-3"
          >
            <GitHubMark />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/sign-in"
            className="ms-1 rounded-lg bg-white px-3.5 py-2 font-semibold text-[#101417] transition-colors hover:bg-white/90"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
