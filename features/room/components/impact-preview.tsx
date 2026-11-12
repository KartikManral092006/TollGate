"use client";

import { ChevronDown, ScanSearch } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GateView } from "@/features/gates/shared/view";
import { cn } from "@/lib/utils";

const SHOWN_LINES = 6;

// Lines that describe something that can't be taken back, or that nobody reviewed.
const WARNING =
  /destroy|replaced|deleted|delete|drops|for good|not pushed|isn't pushed|uncommitted|refuse|outside the repo|didn't finish|can't be deleted/i;

// What the command will actually do, from read-only checks the hook ran on the developer's
// machine after raising the gate: the commit a deploy ships, the package a publish releases,
// the files an rm deletes, pending migrations, a terraform plan.
export function ImpactPreview({ gate }: { gate: Pick<GateView, "preview" | "code"> }) {
  const [expanded, setExpanded] = useState(false);
  if (!gate.preview) return null;
  const [headline, ...details] = gate.preview.split("\n");
  const visible = expanded ? details : details.slice(0, SHOWN_LINES);
  const hidden = details.length - visible.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card px-3 py-2.5 text-sm"
      aria-label={`What TG-${gate.code} will do`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ScanSearch className="size-3.5" aria-hidden />
        What it will do
      </p>
      <p className={cn("font-medium", WARNING.test(headline ?? "") && "text-gate-denied-fg")}>
        {headline}
      </p>
      {details.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 font-mono text-xs">
          <AnimatePresence initial={false}>
            {visible.map((line, index) => (
              <motion.li
                key={`${index}-${line}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "break-all",
                  WARNING.test(line) ? "text-gate-denied-fg" : "text-foreground/80",
                )}
              >
                {line}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {(hidden > 0 || expanded) && details.length > SHOWN_LINES && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {expanded ? "Show less" : `${hidden} more`}
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        Read-only checks on the developer&apos;s machine when the gate was raised.
      </p>
    </motion.div>
  );
}
