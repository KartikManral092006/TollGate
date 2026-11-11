import { Check } from "lucide-react";
import Link from "next/link";
import { LandingFooter } from "@/features/landing/components/footer";
import { SiteHeader } from "@/features/landing/components/site-header";
import { GITHUB_REPO } from "@/components/github-mark";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

// The privacy policy and the terms: same dark look as the docs, a plain-language summary
// first, and an "On this page" list that stays in view on wide screens.

export const LEGAL_UPDATED = "11 November 2026";

const TABS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

export type LegalSection = { id: string; title: string };

export function LegalPage({
  current,
  title,
  intro,
  summary,
  sections,
  children,
}: {
  current: (typeof TABS)[number]["href"];
  title: string;
  intro: React.ReactNode;
  summary: React.ReactNode[];
  sections: LegalSection[];
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex min-h-dvh flex-col bg-[#0b0f12] text-white">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-24 pb-20 sm:px-6 lg:pt-28">
        <nav aria-label="Legal" className="mb-8 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.href === current ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                tab.href === current
                  ? "border-[#f2a900]/50 bg-[#f2a900]/10 text-[#f2c14e]"
                  : "border-white/10 text-white/60 hover:border-white/25 hover:text-white",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <header className="max-w-3xl border-b border-white/10 pb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <div className="mt-3 text-lg leading-relaxed text-white/65">{intro}</div>
          <p className="mt-4 font-mono text-xs text-white/45">Last updated {LEGAL_UPDATED}</p>
        </header>

        <section
          aria-labelledby="short-version"
          className="mt-8 max-w-3xl rounded-2xl border border-[#2ee59d]/25 bg-[#2ee59d]/[0.05] p-5 sm:p-6"
        >
          <h2 id="short-version" className="font-bold">
            The short version
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {summary.map((item, index) => (
              <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-white/80">
                <Check className="mt-0.5 size-4 shrink-0 text-[#2ee59d]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/50">
            This summary helps you find your way; the full text below is what applies.
          </p>
        </section>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-xs text-[#f2a900]">On this page</p>
            <ol className="mt-3 flex flex-col gap-1.5 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex gap-2 rounded-md py-0.5 text-white/60 transition-colors hover:text-white"
                  >
                    <span className="w-5 shrink-0 font-mono text-xs leading-5 text-white/35">
                      {index + 1}.
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
      <LandingFooter />
    </div>
  );
}

// A numbered section heading that matches the "On this page" list.
export function Section({
  section,
  number,
  children,
}: {
  section: LegalSection;
  number: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={section.id} className="mt-14 first:mt-0">
      <h2 id={section.id} className="mb-4 flex scroll-mt-24 gap-3 text-xl font-bold tracking-tight">
        <span className="font-mono text-base leading-7 text-[#f2a900]">{number}.</span>
        <a
          href={`#${section.id}`}
          className="hover:underline hover:decoration-white/30 hover:underline-offset-4"
        >
          {section.title}
        </a>
      </h2>
      {children}
    </section>
  );
}

// How to reach the operator: the configured address, or the public repo until one is set.
export function ContactLink() {
  const email = env.CONTACT_EMAIL;
  const style =
    "font-semibold text-[#f2c14e] underline decoration-[#f2c14e]/40 underline-offset-4 hover:decoration-[#f2c14e]";
  return email ? (
    <a href={`mailto:${email}`} className={style}>
      {email}
    </a>
  ) : (
    <a href={`${GITHUB_REPO}/issues`} className={style} target="_blank" rel="noreferrer">
      an issue on Tollgate&apos;s GitHub
    </a>
  );
}
