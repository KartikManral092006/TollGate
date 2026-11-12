"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useNow } from "@/features/room/components/park-countdown";
import { activityCalendar, type CalendarDay } from "@/features/profile/shared/profile";
import { cn } from "@/lib/utils";

const WEEKS = 26;

// Highway green, from faint to full: the busier the day, the greener the square.
const LEVEL: Record<CalendarDay["level"], string> = {
  0: "bg-muted",
  1: "bg-gate-approved/25",
  2: "bg-gate-approved/50",
  3: "bg-gate-approved/75",
  4: "bg-gate-approved",
};

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function dayTitle(day: CalendarDay): string {
  const date = new Date(`${day.date}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (day.count === 0) return `Nothing on ${date}`;
  return `${day.count} ${day.count === 1 ? "thing" : "things"} on ${date}`;
}

function monthLabels(weeks: CalendarDay[][]): (string | null)[] {
  let last = "";
  const labels = weeks.map((week) => {
    const month = new Date(`${week[0]!.date}T12:00:00`).toLocaleDateString([], { month: "short" });
    if (month === last) return null;
    last = month;
    return month;
  });
  // A month that only shows a week or two at the left edge would collide with the next label.
  if (labels[1] || labels[2]) labels[0] = null;
  return labels;
}

// A GitHub-style calendar of gates raised and reviews given. Days depend on the viewer's
// clock and timezone, so it's drawn after hydration.
export function ActivityCalendar({ times }: { times: number[] }) {
  const now = useNow(60_000);
  const calendar = useMemo(
    () => (now === null ? null : activityCalendar(times, now, WEEKS)),
    [times, now],
  );
  const scroller = useRef<HTMLDivElement>(null);

  // On a phone the grid is wider than the screen: start on the latest weeks.
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [calendar]);

  if (!calendar) {
    return <div className="h-34 animate-pulse rounded-md bg-muted/60" aria-hidden />;
  }
  const months = monthLabels(calendar.weeks);

  return (
    <div className="flex flex-col gap-4">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="inline-grid grid-cols-[auto_1fr] gap-x-2 text-[11px] text-muted-foreground">
          <span />
          <div className="flex gap-0.75" aria-hidden>
            {months.map((month, i) => (
              <span key={i} className="w-3 overflow-visible whitespace-nowrap">
                {month}
              </span>
            ))}
          </div>
          <div className="grid grid-rows-7 gap-0.75" aria-hidden>
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="h-3 leading-3">
                {label}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`${calendar.total} gates and reviews on ${calendar.activeDays} days in the last ${WEEKS} weeks`}
            className="flex gap-0.75"
          >
            {calendar.weeks.map((week, w) => (
              <motion.div
                key={week[0]!.date}
                className="grid grid-rows-7 gap-0.75"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: w * 0.015, duration: 0.25, ease: [0.2, 0, 0, 1] }}
              >
                {week.map((day) => (
                  <span
                    key={day.date}
                    title={day.future ? undefined : dayTitle(day)}
                    className={cn(
                      "size-3 rounded-[3px]",
                      day.future ? "bg-transparent" : LEVEL[day.level],
                    )}
                  />
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <strong className="tabular-nums">{calendar.activeDays}</strong>{" "}
          <span className="text-muted-foreground">active days</span>
        </span>
        <span>
          <strong className="tabular-nums">{calendar.currentStreak}</strong>{" "}
          <span className="text-muted-foreground">
            day{calendar.currentStreak === 1 ? "" : "s"} current streak
          </span>
        </span>
        <span>
          <strong className="tabular-nums">{calendar.longestStreak}</strong>{" "}
          <span className="text-muted-foreground">
            day{calendar.longestStreak === 1 ? "" : "s"} longest streak
          </span>
        </span>
        <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
          Less
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={cn("size-3 rounded-[3px]", LEVEL[level])} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
