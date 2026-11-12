"use client";

import { ListTree, MessageSquareText } from "lucide-react";
import type { GateView } from "@/features/gates/shared/view";
import { cn } from "@/lib/utils";

// What the developer asked the agent to do, and what the agent did since, so an approver can
// judge whether this command fits the job. Only on teams that share it (Settings), from the
// developer's machine with secrets removed. The agent's own reason is a claim; this is the ask.
export function AgentTask({ gate }: { gate: Pick<GateView, "task" | "steps"> }) {
  const steps = gate.steps ?? [];
  if (!gate.task && steps.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
      {gate.task && (
        <div>
          <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquareText className="size-3.5" aria-hidden />
            What the developer asked the agent
          </p>
          <p className="break-words whitespace-pre-wrap">&ldquo;{gate.task}&rdquo;</p>
        </div>
      )}
      {steps.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ListTree className="size-3.5" aria-hidden />
            {gate.task ? "Since then, the agent ran" : "The agent's last calls"}
          </p>
          <ol className="flex flex-col gap-0.5 font-mono text-xs">
            {steps.map((step, index) => {
              const failed = / \((failed|stopped)\)$/.test(step);
              return (
                <li
                  key={`${index}-${step}`}
                  className={cn("break-all", failed ? "text-gate-denied-fg" : "text-foreground/80")}
                >
                  {step}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
