"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GITHUB_REPO } from "@/components/github-mark";
import { Logo } from "@/components/logo";
import { CopyField } from "@/features/settings/components/copy-field";
import { cn } from "@/lib/utils";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
      { label: "Try it in your browser", href: "/#demo" },
      { label: "Docs", href: "/docs" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Source on GitHub", href: GITHUB_REPO, external: true },
      {
        label: "tollgate-cli on npm",
        href: "https://www.npmjs.com/package/tollgate-cli",
        external: true,
      },
      { label: "Claude Code hooks", href: "https://code.claude.com/docs/en/hooks", external: true },
    ],
  },
];

type Health = "checking" | "ok" | "degraded" | "down";

// Whether the live service answers right now, from its own health check.
function useHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { status?: string };
        setHealth(body.status === "ok" ? "ok" : "degraded");
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth("down");
      });
    return () => controller.abort();
  }, []);
  return health;
}

const HEALTH_COPY: Record<Health, { label: string; dot: string }> = {
  checking: { label: "Checking the gate…", dot: "bg-white/40" },
  ok: { label: "Gate open: all systems running", dot: "bg-[#2ee59d]" },
  degraded: { label: "Gate open, running slow", dot: "bg-[#f2a900]" },
  down: { label: "Can't reach the gate right now", dot: "bg-[#ff3b5c]" },
};

// The landing page's last word: where to go next, what it's built on, and a closing
// moment. As the page bottoms out, the wordmark rises letter by letter and the toll-gate
// arm lifts, its light turning from red to green: the road is clear.
export function LandingFooter() {
  const root = useRef<HTMLElement>(null);
  const health = useHealth();
  const status = HEALTH_COPY[health];

  // The animation (and GSAP with it) loads only once the footer is within ~600 px of view.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void import("@/features/landing/components/footer-motion").then(({ animateFooter }) => {
          if (!cancelled) cleanup = animateFooter(element);
        });
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      cleanup?.();
    };
  }, []);

  return (
    <footer ref={root} className="relative overflow-hidden border-t border-white/10 bg-[#080b0d]">
      {/* An amber scan light running along the top edge. */}
      <span
        aria-hidden
        className="absolute top-0 left-0 h-px w-1/3 animate-[fx-footer-scan_6s_linear_infinite] bg-gradient-to-r from-transparent via-[#f2a900] to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_100%,rgb(242_169_0/0.08),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.6fr_repeat(2,minmax(0,1fr))] lg:gap-12">
          <div data-footer-col className="col-span-2 flex flex-col gap-5 lg:col-span-1">
            <Logo className="text-white" />
            <p className="max-w-sm text-sm leading-relaxed text-white/60">
              Approval gates for Claude Code. Your agent moves fast; production waits for your team.
            </p>
            <div className="max-w-sm">
              <CopyField value="npx tollgate-cli init --token tg_…" label="setup command" />
            </div>
            <p
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/65"
              aria-live="polite"
            >
              <span className="relative flex size-2">
                {health === "ok" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#2ee59d] opacity-60 motion-reduce:hidden" />
                )}
                <span className={cn("relative inline-flex size-2 rounded-full", status.dot)} />
              </span>
              {status.label}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} data-footer-col aria-label={column.title}>
              <h2 className="font-mono text-xs text-[#f2a900]">{column.title}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1 text-sm text-white/65 transition-colors hover:text-white"
                      >
                        <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                          {link.label}
                        </span>
                        <ArrowUpRight className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="group inline-flex text-sm text-white/65 transition-colors hover:text-white"
                      >
                        <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                          {link.label}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* The finale: the gate opens at the end of the road. */}
        {/* Clipped, so the lifted arm rises out of view instead of across the links. */}
        <div data-finale className="relative mt-14 overflow-hidden pt-10 select-none" aria-hidden>
          <div className="absolute bottom-[38%] left-0 z-10 flex items-center sm:bottom-[42%]">
            {/* The post, its lamp, and the striped arm pivoting at the post. */}
            <span className="relative block h-16 w-3 rounded-sm bg-[#1c2328] ring-1 ring-white/10 sm:h-24 sm:w-4">
              <span
                data-lamp
                className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#ff3b5c] shadow-[0_0_18px_3px_rgb(255_59_92/0.6)] sm:size-4"
              />
            </span>
            <span
              data-arm
              className="block h-2.5 w-[72vw] max-w-[860px] origin-left rounded-full bg-[repeating-linear-gradient(-45deg,#c8102e_0_14px,#f4f4f4_14px_28px)] shadow-[0_6px_24px_-6px_rgb(200_16_46/0.6)] ring-1 ring-black/20 sm:h-3.5"
            />
          </div>
          <p
            data-wordmark
            className="[mask-image:linear-gradient(to_bottom,#000_35%,transparent_95%)] pb-2 text-center text-[22vw] leading-[0.82] font-extrabold tracking-[-0.04em] text-white/[0.09] lg:text-[15rem]"
          >
            Tollgate
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Kartik Manral. Tollgate&apos;s source is public on GitHub.</p>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <span className="hidden text-white/35 md:inline">
              It can only stop commands, never run them.
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
