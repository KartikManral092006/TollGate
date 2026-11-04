"use client";

import { useEffect, useRef } from "react";
import type { GateView } from "@/features/gates/shared/view";

// Reports the waiting card on screen as seen, once per card per page load, so the requester's
// card can say "Seen by Ana". Their own gates don't count; the server ignores decided ones.
export function useReportSeen({
  gates,
  viewing,
  viewerId,
}: {
  gates: GateView[];
  viewing: string | null;
  viewerId: string;
}) {
  const reported = useRef(new Set<string>());

  useEffect(() => {
    if (!viewing || reported.current.has(viewing)) return;
    const gate = gates.find((g) => g.id === viewing);
    if (!gate || gate.requester.id === viewerId) return;
    if (gate.seenBy?.some((look) => look.userId === viewerId)) return;
    const done = reported.current;
    done.add(viewing);
    let fired = false;
    // Looking for a moment counts; scrolling past doesn't.
    const timer = setTimeout(() => {
      fired = true;
      void fetch(`/api/gates/${viewing}/seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => done.delete(viewing));
    }, 1200);
    return () => {
      clearTimeout(timer);
      if (!fired) done.delete(viewing);
    };
  }, [viewing, gates, viewerId]);
}
