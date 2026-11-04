"use client";

import { Timer } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GateView } from "@/features/gates/shared/view";
import { WINDOW_MINUTES, windowKind, windowLabel } from "@/features/gates/shared/windows";
import { useNow } from "@/features/room/components/park-countdown";
import { cn } from "@/lib/utils";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const ASK = "ask";
const ITEMS: Record<string, string> = {
  [ASK]: "Ask each time",
  ...Object.fromEntries(
    WINDOW_MINUTES.map((minutes) => [String(minutes), `Approve for ${windowLabel(minutes)}`]),
  ),
};

// Beside Approve: also approve the same kind of gate from this agent for a while.
export function WindowPicker({
  gate,
  value,
  onChange,
}: {
  gate: GateView;
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        Next <span className="font-medium text-foreground">{windowKind(gate)}</span> from{" "}
        {gate.requester.name}&apos;s agent:
      </span>
      <Select
        items={ITEMS}
        value={value === null ? ASK : String(value)}
        onValueChange={(next) => onChange(next === ASK ? null : Number(next))}
      >
        <SelectTrigger
          size="sm"
          className="h-8 min-w-40 text-xs"
          aria-label={`After TG-${gate.code}, for ${gate.requester.name}'s next ${windowKind(gate)}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ITEMS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// On a gate that a window approved, and on the gate a window was opened from.
export function WindowLines({
  gate,
  onEnd,
}: {
  gate: GateView;
  // Present when the viewer may end a window early.
  onEnd?: (windowId: string) => void;
}) {
  const now = useNow(30_000);
  const opened = gate.opened;
  if (!gate.window && !opened) return null;
  const openNow =
    opened !== null && opened.endedAt === null && now !== null && Date.parse(opened.until) > now;
  const kind = windowKind(gate);
  const approvedSoFar =
    opened && opened.used > 0
      ? ` ${opened.used} ${opened.used === 1 ? "gate" : "gates"} approved by it${openNow ? " so far" : ""}.`
      : "";

  return (
    <>
      {gate.window && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Timer className="mt-px size-3.5 shrink-0" aria-hidden />
          <span suppressHydrationWarning>
            Approved on arrival by {gate.window.by}&apos;s window for {kind} from{" "}
            {gate.requester.name}&apos;s agent, open until {clock(gate.window.until)}.
          </span>
        </p>
      )}
      {opened && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-3 py-2 text-xs",
            openNow
              ? "bg-gate-approved-bg text-gate-approved-fg"
              : "bg-muted text-muted-foreground",
          )}
        >
          <p className="flex min-w-0 items-start gap-1.5">
            <Timer className="mt-px size-3.5 shrink-0" aria-hidden />
            <span suppressHydrationWarning>
              {opened.endedAt
                ? `${opened.by}'s window for ${kind} was ended ${opened.endedBy ? `by ${opened.endedBy} ` : ""}at ${clock(opened.endedAt)}.${approvedSoFar}`
                : openNow
                  ? `${opened.by} let ${gate.requester.name}'s agent run ${kind} without asking until ${clock(opened.until)}.${approvedSoFar}`
                  : `${opened.by}'s window for ${kind} closed at ${clock(opened.until)}.${approvedSoFar}`}
            </span>
          </p>
          {openNow && onEnd && (
            <button
              type="button"
              onClick={() => onEnd(opened.id)}
              className="shrink-0 rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              End now
            </button>
          )}
        </div>
      )}
    </>
  );
}
