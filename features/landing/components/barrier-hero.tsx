"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The page's one orchestrated moment: an agent's command rolls up to a toll gate, the barrier
// arm drops, a teammate approves, the arm lifts and the command runs. Reduced motion shows a
// single still frame with the barrier down.

const COMMAND = "npx prisma migrate deploy";

type Phase = "typing" | "blocked" | "approved" | "ran";

const TIMELINE: { phase: Phase; ms: number }[] = [
  { phase: "typing", ms: 1700 },
  { phase: "blocked", ms: 2600 },
  { phase: "approved", ms: 1100 },
  { phase: "ran", ms: 2400 },
];

function useLoop(enabled: boolean): Phase {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % TIMELINE.length), TIMELINE[index]!.ms);
    return () => clearTimeout(timer);
  }, [index, enabled]);
  return enabled ? TIMELINE[index]!.phase : "blocked";
}

function Typed({ active }: { active: boolean }) {
  const [count, setCount] = useState(COMMAND.length);
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const reset = setTimeout(() => setCount(0), 0);
    const timer = setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= COMMAND.length) clearInterval(timer);
    }, 45);
    return () => {
      clearTimeout(reset);
      clearInterval(timer);
    };
  }, [active]);
  return (
    <>
      {COMMAND.slice(0, count)}
      {count < COMMAND.length && <span className="animate-pulse">▍</span>}
    </>
  );
}

export function BarrierHero() {
  const reduced = useReducedMotion() ?? false;
  const phase = useLoop(!reduced);
  const down = phase === "blocked" || (reduced && phase !== "ran");
  const ran = phase === "ran";

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none sm:max-w-lg">
      {/* Road: asphalt with a dashed lane line */}
      <div className="relative flex h-[22rem] flex-col overflow-hidden rounded-3xl bg-asphalt px-5 pt-6 pb-14 shadow-2xl sm:h-[24rem] sm:px-7">
        <div className="absolute inset-x-0 bottom-6 h-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.35)_0_28px,transparent_28px_52px)]" />

        <p className="font-mono text-xs text-white/50">claude · ~/acme/billing</p>
        {/* Open sky above the road, where the arm swings up to. */}
        <div className="flex-1" />
        <p className="font-mono text-[15px] leading-relaxed text-white">
          <span className="text-white/45">❯ </span>
          {phase === "typing" ? <Typed active /> : COMMAND}
        </p>

        <div className="mt-8 h-7">
          <AnimatePresence mode="wait">
            {down && (
              <motion.p
                key="wait"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 font-mono text-sm text-signal"
              >
                <span className="size-2.5 animate-pulse rounded-full bg-signal shadow-[0_0_12px_var(--signal)]" />
                Waiting on your team · TG-17
              </motion.p>
            )}
            {phase === "approved" && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 font-mono text-sm text-[#4fd199]"
              >
                <Check className="size-4" /> Ana approved TG-17
              </motion.p>
            )}
            {ran && (
              <motion.p
                key="ran"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-mono text-sm text-white/70"
              >
                1 migration applied. Done.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Toll gate: post + striped arm pivoting at the post */}
        <div className="pointer-events-none absolute right-5 bottom-8 sm:right-7">
          <div className="relative h-24 w-5">
            <div className="absolute bottom-0 left-0 h-24 w-5 rounded-t-md bg-[#d6d9d4] shadow-inner" />
            <div
              className={cn(
                "absolute top-2 left-1/2 size-3 -translate-x-1/2 rounded-full transition-colors duration-300",
                down
                  ? "bg-gate-denied shadow-[0_0_14px_var(--gate-denied)]"
                  : "bg-[#2eb67d] shadow-[0_0_14px_#2eb67d]",
              )}
            />
            <motion.div
              className="absolute top-6 right-2.5 h-4 w-[17rem] origin-right rounded-full border border-black/10 bg-[repeating-linear-gradient(-45deg,#c8102e_0_14px,#ffffff_14px_28px)] shadow-lg sm:w-[19rem]"
              initial={false}
              animate={{ rotate: down ? 0 : 68 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : down
                    ? { type: "spring", stiffness: 260, damping: 18 }
                    : { duration: 0.55, ease: [0.3, 0, 0.2, 1] }
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
