"use client";

import {
  ClipboardList,
  Eye,
  Keyboard,
  Lock,
  MessageSquareWarning,
  PauseCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useRef, useState } from "react";
import { BorderBeam } from "@/components/fx/border-beam";
import {
  DenyReason,
  Parks,
  Record,
  Redact,
  Review,
  SeeThrough,
  Signals,
} from "@/features/landing/components/feature-demos";
import { cn } from "@/lib/utils";

type Chapter = {
  icon: LucideIcon;
  title: string;
  body: string;
  demo: React.ComponentType;
  // The stage's glow while this chapter is on screen.
  glow: string;
  label: string;
};

const CHAPTERS: Chapter[] = [
  {
    icon: Eye,
    title: "Sees what a command really runs",
    body: "Package scripts, wrappers and piped installers are opened up before matching. pnpm db:deploy is caught as the migration it is, and the SQL that destroys data is marked.",
    demo: SeeThrough,
    glow: "rgb(242 169 0 / 0.22)",
    label: "acme/billing · package.json",
  },
  {
    icon: Lock,
    title: "Secrets never leave the laptop",
    body: "Tokens, passwords and every value in your .env files are redacted by the hook before anything is sent, then checked again on the server.",
    demo: Redact,
    glow: "rgb(46 182 125 / 0.22)",
    label: "tollgate hook · local redaction",
  },
  {
    icon: TriangleAlert,
    title: "Risk you can see before you vote",
    body: "Plain-language warnings read from the SQL and the command, and what your team decided the last time it saw something like it.",
    demo: Signals,
    glow: "rgb(229 72 93 / 0.22)",
    label: "TG-17 · risk signals",
  },
  {
    icon: MessageSquareWarning,
    title: "Deny with a reason, and the agent replans",
    body: "Your reason reaches the agent word for word as its next instruction. Not sure yet? Ask it a question; its answer comes back with the retry.",
    demo: DenyReason,
    glow: "rgb(229 72 93 / 0.18)",
    label: "team room · TG-17",
  },
  {
    icon: PauseCircle,
    title: "Nobody awake? It parks",
    body: "Before the hook times out the gate parks and the agent moves on. Approve it in the morning and the same command passes, once.",
    demo: Parks,
    glow: "rgb(138 144 150 / 0.22)",
    label: "TG-22 · parks at timeout",
  },
  {
    icon: Keyboard,
    title: "Clear the queue from the keyboard",
    body: "Review mode shows waiting gates one at a time, oldest first, with the explanation already open. J and K to move, A to approve, D to deny.",
    demo: Review,
    glow: "rgb(46 182 125 / 0.18)",
    label: "review · 4 waiting",
  },
  {
    icon: ClipboardList,
    title: "Every decision on record",
    body: "Who approved what, why and how fast, with 12-day trends, a rubber-stamp rate and a CSV export for the post-mortem.",
    demo: Record,
    glow: "rgb(242 169 0 / 0.16)",
    label: "audit log · last 30 days",
  },
];

// The scroll story: the chapters scroll past on the left while a stage stays pinned on the
// right and turns to each chapter's live demo. Phones get the chapters stacked, each with its
// demo, and no pinning.
export function FeatureStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 35%", "end 65%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

  // A chapter takes the stage when it crosses the middle of the screen.
  const show = (index: number) => {
    if (index === active) return;
    setDirection(index > active ? 1 : -1);
    setActive(index);
  };

  const chapter = CHAPTERS[active]!;

  return (
    <>
      {/* Wide screens: chapters on the left, a pinned stage on the right. */}
      <div
        ref={ref}
        className="relative hidden gap-16 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <div className="relative">
          {/* The progress rail fills as the story is read. */}
          <span aria-hidden className="absolute top-0 bottom-0 left-5 w-px bg-white/10" />
          <motion.span
            aria-hidden
            style={{ scaleY: reduced ? 1 : progress }}
            className="absolute top-0 bottom-0 left-5 w-px origin-top bg-gradient-to-b from-[#2eb67d] via-[#f2a900] to-[#e5485d]"
          />
          {CHAPTERS.map((item, index) => {
            const on = index === active;
            return (
              <motion.div
                key={item.title}
                className="flex min-h-[70vh] items-center"
                viewport={{ margin: "-48% 0px -48% 0px" }}
                onViewportEnter={() => show(index)}
              >
                <motion.div
                  animate={{ opacity: on ? 1 : 0.28, x: on ? 0 : -6 }}
                  transition={{ duration: 0.4 }}
                  className="flex gap-5"
                >
                  <span
                    className={cn(
                      "relative z-10 grid size-10 shrink-0 place-items-center rounded-xl border transition-colors duration-500",
                      on
                        ? "border-[#2eb67d]/60 bg-[#2eb67d]/15 text-[#4fd199] shadow-[0_0_30px_-6px_rgb(46_182_125/0.7)]"
                        : "border-white/10 bg-[#151a1e] text-white/50",
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                  <div className="max-w-md">
                    <h3 className="text-2xl font-extrabold tracking-tight text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-white/60">{item.body}</p>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <div className="relative">
          <div className="sticky top-[18vh] h-[64vh]" style={{ perspective: 1400 }}>
            {/* The glow behind the stage takes each chapter's colour. */}
            <motion.div
              aria-hidden
              animate={{
                background: `radial-gradient(60% 60% at 50% 50%, ${chapter.glow}, transparent 70%)`,
              }}
              transition={{ duration: 0.8 }}
              className="absolute -inset-16 -z-10 blur-2xl"
            />
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0e1215]/90 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.8)] backdrop-blur">
              <BorderBeam radius={24} duration={8} />
              <div className="flex items-center gap-1.5 border-b border-white/10 px-5 py-3">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={chapter.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="ms-3 font-mono text-xs text-white/45"
                  >
                    {chapter.label}
                  </motion.span>
                </AnimatePresence>
                <span className="ms-auto font-mono text-xs text-white/35 tabular-nums">
                  {active + 1}/{CHAPTERS.length}
                </span>
              </div>
              <div className="relative flex flex-1 items-center justify-center p-8">
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                  <motion.div
                    key={active}
                    custom={direction}
                    variants={{
                      enter: (d: number) => ({
                        opacity: 0,
                        rotateX: d * -28,
                        y: d * 60,
                        scale: 0.92,
                        filter: "blur(8px)",
                      }),
                      center: { opacity: 1, rotateX: 0, y: 0, scale: 1, filter: "blur(0px)" },
                      exit: (d: number) => ({
                        opacity: 0,
                        rotateX: d * 28,
                        y: d * -60,
                        scale: 0.92,
                        filter: "blur(8px)",
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", stiffness: 170, damping: 22 }}
                    className="flex w-full justify-center"
                  >
                    {/* Larger than in the stacked layout: the stage is the hero here. */}
                    <div className="flex w-full scale-[1.3] justify-center">
                      <chapter.demo />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phones and tablets: each chapter with its demo, rising in as it scrolls into view. */}
      <div className="flex flex-col gap-6 lg:hidden">
        {CHAPTERS.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 40, rotateX: 12 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.6, delay: (index % 2) * 0.05, ease: [0.2, 0, 0, 1] }}
            style={{ transformPerspective: 900 }}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            <div className="flex min-h-48 items-center justify-center border-b border-white/10 p-5">
              <item.demo />
            </div>
            <div className="flex gap-3 p-5">
              <item.icon className="mt-0.5 size-5 shrink-0 text-[#4fd199]" />
              <div>
                <h3 className="font-bold text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{item.body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
