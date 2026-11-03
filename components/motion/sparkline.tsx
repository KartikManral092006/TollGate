"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const W = 120;
const H = 32;
const PAD = 4;

// A small trend under a stat: a quiet 2px line with the latest day in the accent, gaps where a
// day had nothing to measure, and a readout on hover. The table below holds every value too.
export function Sparkline({
  values,
  days,
  format,
  label,
  className,
}: {
  values: (number | null)[];
  days: string[];
  format: (value: number) => string;
  label: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) {
    return <p className={cn("h-8 text-xs text-muted-foreground", className)}>No data yet</p>;
  }
  const max = Math.max(...present, 0);
  const min = Math.min(...present, 0);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  // One path, broken where a day has no value.
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${i === 0 || values[i - 1] === null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const last = values.reduce<number | null>((found, v, i) => (v === null ? found : i), null);
  const shown = hover ?? last;
  const dayName = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
  const summary = values
    .map((v, i) => `${dayName(days[i]!)}: ${v === null ? "none" : format(v)}`)
    .join(", ");

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-8 w-full overflow-visible"
        role="img"
        aria-labelledby={id}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round(ratio * (values.length - 1));
          setHover(Math.min(values.length - 1, Math.max(0, index)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title id={id}>{`${label}, last ${values.length} days. ${summary}`}</title>
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={H}
            className="stroke-border"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={d}
          fill="none"
          className="stroke-muted-foreground/45"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The marker is HTML so it stays round while the line stretches to the width. */}
      {shown !== null && values[shown] !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute size-2 -translate-1/2 rounded-full bg-primary ring-2 ring-background"
          style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(values[shown]!) / H) * 100}%` }}
        />
      )}
      {hover !== null && (
        <p
          className="pointer-events-none absolute -top-6 z-10 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background tabular-nums"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <span className="font-semibold">
            {values[hover] === null ? "None" : format(values[hover]!)}
          </span>{" "}
          {dayName(days[hover]!)}
        </p>
      )}
    </div>
  );
}
