"use client";

import { ArrowRight, GitBranch, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { ShimmerLink } from "@/components/fx/shimmer-button";
import { GateStream } from "@/features/landing/components/gate-stream";
import { gsap, SplitText, useGSAP } from "@/features/landing/motion/gsap";

const LINE_ONE = "Your agent moves fast.";
const LINE_TWO = "Production waits for your team.";

// The hero: a gate of light that an agent's commands must pass, and the promise in two lines.
// The section is taller than the screen; its stage sticks while scrolling flies the camera
// through the gate and the words drift away.
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const lineTwo = root.current?.querySelector<HTMLElement>("[data-line-two]");
        // Words first, so a word never breaks across lines; letters rise inside each word.
        const split = SplitText.create("[data-line-one]", { type: "words,chars", mask: "words" });
        const intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.25 });
        intro
          .from("[data-eyebrow]", { y: 18, autoAlpha: 0, duration: 0.9 })
          .from(split.chars, { yPercent: 115, duration: 1.1, stagger: 0.024 }, "-=0.55")
          .set(lineTwo ?? [], { autoAlpha: 1, textContent: "" }, "-=0.6")
          .to(
            lineTwo ?? [],
            {
              duration: 1.5,
              ease: "none",
              scrambleText: { text: LINE_TWO, chars: "01<>/$#_|", speed: 0.7, revealDelay: 0.25 },
            },
            "<",
          )
          .from("[data-rise]", { y: 26, autoAlpha: 0, duration: 1, stagger: 0.1 }, "-=0.9");

        // Scrolling away: the stream fades (the words stay put, clear of the navbar).
        gsap.to("[data-stream]", {
          autoAlpha: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
        gsap.to("[data-scroll-hint]", {
          autoAlpha: 0,
          scrollTrigger: { trigger: root.current, start: "top top", end: "15% top", scrub: true },
        });
      });
    },
    { scope: root },
  );

  return (
    // A normal full-height section padded below the fixed navbar, so the words can never
    // start under it, whatever the screen height.
    <section ref={root} className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[#0b0f12] bg-[radial-gradient(40%_50%_at_70%_55%,rgb(242_169_0/0.06),transparent_70%)]"
      />
      <div data-stream className="absolute inset-0 -z-10">
        <GateStream className="absolute inset-0" />
      </div>
      {/* Keeps the words readable over the stream. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0b0f12_0%,rgb(11_15_18/0.82)_34%,transparent_62%)] max-lg:bg-[linear-gradient(180deg,rgb(11_15_18/0.92)_0%,rgb(11_15_18/0.7)_48%,transparent_80%)]"
      />
      <div
        data-hero-content
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-28 pb-28 sm:px-6"
      >
        <div className="flex max-w-xl flex-col gap-7">
          <span
            data-eyebrow
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-[#f2a900]" />
            Approval gates for Claude Code
          </span>
          <h1 className="text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-[4.1rem]">
            <span className="sr-only">
              {LINE_ONE} {LINE_TWO}
            </span>
            <span aria-hidden data-line-one className="block">
              {LINE_ONE}
            </span>
            {/* An invisible copy holds the line's space, so the scramble typing over it can
                never push the content below around (no layout shift). */}
            <span aria-hidden className="relative block">
              <span className="invisible block">{LINE_TWO}</span>
              <span
                data-line-two
                className="absolute inset-x-0 top-0 block bg-gradient-to-r from-[#f2a900] via-[#ffd27a] to-[#2ee59d] bg-clip-text text-transparent"
              >
                {LINE_TWO}
              </span>
            </span>
          </h1>
          <p data-rise className="text-lg leading-relaxed text-pretty text-white/70">
            Tollgate pauses Claude Code before it deploys, migrates, publishes or deletes, and asks
            your team in a live thread. Deny with a reason and the agent changes its plan.
          </p>
          <div data-rise className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ShimmerLink href="#demo">
              Try it in your browser <ArrowRight className="size-4" />
            </ShimmerLink>
            <Link
              href="/sign-in"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-6 font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              Set it up for my team
            </Link>
          </div>
          <div data-rise className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4 text-[#2ee59d]" /> Secrets redacted on your machine
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="size-4 text-[#2ee59d]" /> Sees inside package scripts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert className="size-4 text-[#f2a900]" /> Blocks if unreachable
            </span>
          </div>
        </div>
      </div>
      <div
        data-scroll-hint
        aria-hidden
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] text-white/45"
      >
        Scroll to see how it works
        <span className="relative h-9 w-5 rounded-full border border-white/25">
          <span className="absolute top-1.5 left-1/2 size-1 -translate-x-1/2 animate-[fx-scroll-dot_1.6s_ease-in-out_infinite] rounded-full bg-white/70" />
        </span>
      </div>
    </section>
  );
}
