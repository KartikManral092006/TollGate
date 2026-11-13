"use client";

import { Bot } from "lucide-react";
import { motion } from "motion/react";
import type { GateView } from "@/features/gates/shared/view";
import { timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

const SEGMENT: Record<GateView["status"], string> = {
  pending: "bg-gate-pending",
  parked: "bg-gate-parked",
  approved: "bg-gate-approved",
  denied: "bg-gate-denied",
  expired: "bg-muted-foreground/40",
  bypassed: "bg-gate-denied",
};

// One Claude Code session's run of gates, above its first one: who, where, and a segment per
// gate coloured by where it stands, so a long agent run reads as one piece of work.
export function SessionStrip({
  gates,
  mine,
  onJump,
}: {
  gates: GateView[];
  mine: boolean;
  onJump: (gateId: string) => void;
}) {
  const first = gates[0]!;
  const last = gates.at(-1)!;
  const count = (...statuses: GateView["status"][]) =>
    gates.filter((gate) => statuses.includes(gate.status)).length;
  const parts = [
    [count("pending", "parked"), "waiting"],
    [count("approved"), "approved"],
    [count("denied"), "denied"],
  ] as const;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pt-4 pb-1 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-4">
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground sm:size-9">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-semibold">
            {mine ? "Your agent's" : `${first.requester.name}'s agent's`}
          </span>{" "}
          <span className="text-muted-foreground">
            session in <span className="font-mono">{first.repo}</span>, {gates.length} gates
          </span>
        </p>
        <div className="mt-2 flex items-center gap-1" aria-hidden>
          {gates.map((gate) => (
            <motion.button
              key={gate.id}
              type="button"
              tabIndex={-1}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              onClick={() => onJump(gate.id)}
              title={`TG-${gate.code}: ${gate.status}`}
              className={cn(
                "h-1.5 min-w-4 flex-1 origin-left rounded-full transition-colors duration-500 sm:max-w-16",
                SEGMENT[gate.status],
              )}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {parts
            .filter(([n]) => n > 0)
            .map(([n, label]) => `${n} ${label}`)
            .join(", ")}
          <span suppressHydrationWarning>, last gate {timeAgo(last.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}
