"use client";

import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { ActivityEvent } from "@/features/activity/shared/activity";
import { dayLabel, timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

const DOT: Record<ActivityEvent["kind"], string> = {
  raised: "bg-gate-pending",
  approved: "bg-gate-approved",
  auto: "bg-gate-approved",
  denied: "bg-gate-denied",
  asked: "bg-gate-pending",
  parked: "bg-gate-parked",
};

// A bell in the sidebar with what happened in your teams; opening it marks it all as read.
export function ActivityBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { events: ActivityEvent[]; unread: number };
      setEvents(body.events);
      setUnread(body.unread);
    } catch {
      // offline; the next check catches up
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    // Background tabs skip the check; focusing the window loads at once.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  function show(next: boolean) {
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      void fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Activity, ${unread} new` : "Activity"}
        onClick={() => show(true)}
        className={cn("relative", className)}
      >
        <Bell />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] leading-4 font-bold text-signal-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
      <Sheet open={open} onOpenChange={show}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <div className="border-b px-5 py-4">
            <SheetTitle className="text-lg font-bold">Activity</SheetTitle>
            <SheetDescription>The last week in your teams.</SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-5">
            {events.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">Nothing has happened yet.</p>
            ) : (
              <ol>
                {events.map((event, index) => {
                  const day = dayLabel(event.at);
                  const showDay = index === 0 || dayLabel(events[index - 1]!.at) !== day;
                  return (
                    <li key={event.id}>
                      {showDay && (
                        <p className="pt-4 pb-1 text-xs font-semibold text-muted-foreground">
                          {day}
                        </p>
                      )}
                      <Link
                        href={`/teams/${event.teamId}/gates/${event.gateId}`}
                        onClick={() => setOpen(false)}
                        className="-mx-2 flex gap-3 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <span
                          aria-hidden
                          className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[event.kind])}
                        />
                        <span className="min-w-0">
                          <span className={cn("block text-sm", event.mine && "font-medium")}>
                            {event.text}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {event.teamName}, {timeAgo(event.at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
