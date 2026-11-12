"use client";

import { ChevronDown, CircleCheck, CircleSlash, CircleX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GateRunView, GateView } from "@/features/gates/shared/view";
import { timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

const LOOK: Record<GateRunView["outcome"], { icon: typeof CircleCheck; text: string }> = {
  succeeded: { icon: CircleCheck, text: "text-gate-approved-fg" },
  failed: { icon: CircleX, text: "text-gate-denied-fg" },
  interrupted: { icon: CircleSlash, text: "text-muted-foreground" },
};

export function runSummary(gate: Pick<GateView, "tool">, ran: GateRunView): string {
  const noun = gate.tool === "bash" ? "Ran" : gate.tool === "edit" ? "Changed the file" : "Called";
  if (ran.outcome === "succeeded") return `${noun} and succeeded`;
  if (ran.outcome === "interrupted") return "Stopped before it finished";
  return ran.exitCode !== null && ran.exitCode !== 0
    ? `${noun} and failed (exit ${ran.exitCode})`
    : `${noun} and failed`;
}

// After approval: what actually happened when the agent ran it, reported by the CLI's
// after-the-call hooks. Failures open their output by default; that's what people look for.
export function RunResult({ gate }: { gate: GateView }) {
  const ran = gate.ran;
  const [open, setOpen] = useState(ran?.outcome === "failed");
  if (!ran) return null;
  const look = LOOK[ran.outcome];
  const Icon = look.icon;
  return (
    <div className="flex flex-col gap-1.5 text-xs" data-run-outcome={ran.outcome}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground">
        <Icon className={cn("size-3.5 shrink-0", look.text)} aria-hidden />
        <span className={cn("font-medium", look.text)}>{runSummary(gate, ran)}</span>
        {ran.durationMs !== null && (
          <>
            <span aria-hidden>·</span>
            <span>took {formatDuration(ran.durationMs)}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span suppressHydrationWarning>{timeAgo(ran.at)}</span>
        {ran.output && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="ms-1 inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Output
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
      </p>
      <AnimatePresence initial={false}>
        {open && ran.output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="max-h-56 overflow-auto rounded-lg bg-asphalt px-3 py-2 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-white/85">
              {ran.output}
            </pre>
            <p className="mt-1 text-muted-foreground">
              The last lines only, with secrets hidden on the developer&apos;s machine.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
