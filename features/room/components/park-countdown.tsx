"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// A clock that ticks once a second, starting after hydration so server and client agree.
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

export function parkLabel(remainingMs: number): string {
  if (remainingMs <= 0) return "Parking…";
  const total = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `Parks in ${minutes}:${String(seconds).padStart(2, "0")}`;
}

// How long the agent will keep waiting before it gives up and parks the gate: a ring that
// empties and a label. Turns red in the last minute.
export function ParkCountdown({
  createdAt,
  parksAt,
  className,
  compact = false,
}: {
  createdAt: string;
  parksAt: string;
  className?: string;
  compact?: boolean;
}) {
  const now = useNow();
  if (now === null) return null;
  const end = Date.parse(parksAt);
  const total = Math.max(1, end - Date.parse(createdAt));
  const remaining = end - now;
  const fraction = Math.min(1, Math.max(0, remaining / total));
  const urgent = remaining < 60_000;
  const radius = 6;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium tabular-nums",
        urgent ? "text-gate-denied-fg" : "text-muted-foreground",
        className,
      )}
      role="timer"
      aria-label={parkLabel(remaining)}
    >
      <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
        <circle cx="8" cy="8" r={radius} fill="none" className="stroke-border" strokeWidth="2.5" />
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-linear",
            urgent ? "stroke-gate-denied" : "stroke-gate-pending",
          )}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      {compact ? parkLabel(remaining).replace("Parks in ", "") : parkLabel(remaining)}
    </span>
  );
}
