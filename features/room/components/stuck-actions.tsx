"use client";

import { MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { HoldButton } from "@/components/hold-button";
import { Button } from "@/components/ui/button";
import type { GateView } from "@/features/gates/shared/view";
import { needsHold } from "@/features/room/components/gate-card";

// The gate being read whose own buttons are off screen, if any. Phones only use it.
function useStuckGate(gates: GateView[]): GateView | null {
  const [stuckId, setStuckId] = useState<string | null>(null);

  useEffect(() => {
    const visibleGates = new Set<string>();
    const visibleActions = new Set<string>();
    const pick = () => {
      const id = [...visibleGates].find((gateId) => !visibleActions.has(gateId)) ?? null;
      setStuckId(id);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const gateId = element.dataset.actionable ?? element.dataset.gateActions;
        if (!gateId) continue;
        const set = element.dataset.actionable ? visibleGates : visibleActions;
        if (entry.isIntersecting) set.add(gateId);
        else set.delete(gateId);
      }
      pick();
    });
    document
      .querySelectorAll<HTMLElement>("[data-actionable], [data-gate-actions]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [gates]);

  return gates.find((gate) => gate.id === stuckId) ?? null;
}

// On phones, a long gate pushes its buttons off screen while you read it: they ride along at
// the bottom until the gate's own buttons come back into view.
export function StuckActions({
  gates,
  onApprove,
  onDeny,
  onAsk,
}: {
  gates: GateView[];
  onApprove: (gate: GateView) => void;
  onDeny: (gate: GateView) => void;
  onAsk: (gate: GateView) => void;
}) {
  const gate = useStuckGate(gates);
  return (
    <AnimatePresence>
      {gate && (
        <motion.div
          key={gate.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2 pb-2 sm:hidden"
        >
          <span className="me-auto font-mono text-sm font-bold">TG-{gate.code}</span>
          {gate.status === "pending" && (
            <Button size="icon" variant="ghost" aria-label="Ask" onClick={() => onAsk(gate)}>
              <MessageCircleQuestion />
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 border-gate-denied/40 text-gate-denied-fg"
            onClick={() => onDeny(gate)}
          >
            <ThumbsDown /> Deny…
          </Button>
          {needsHold(gate) ? (
            <HoldButton
              className="h-10"
              onHold={() => onApprove(gate)}
              label={`Hold to approve TG-${gate.code}`}
            >
              <ThumbsUp /> Hold
            </HoldButton>
          ) : (
            <Button className="h-10" onClick={() => onApprove(gate)}>
              <ThumbsUp /> Approve
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
