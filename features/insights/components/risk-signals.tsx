import { TriangleAlert } from "lucide-react";
import type { RiskSignal } from "@/features/insights/shared/types";
import { cn } from "@/lib/utils";

// One line per risk, in plain words. High risks in barrier red, the rest in signal amber; the
// icon and the words carry the meaning, not the colour.
export function RiskSignals({ signals }: { signals: RiskSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Risks to check">
      {signals.map((signal) => (
        <li
          key={signal.id}
          className={cn(
            "flex items-start gap-2 text-sm font-medium",
            signal.level === "high" ? "text-gate-denied-fg" : "text-gate-pending-fg",
          )}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">{signal.level === "high" ? "High risk: " : "Check: "}</span>
            {signal.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
