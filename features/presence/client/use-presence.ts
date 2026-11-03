"use client";

import { useEffect, useState } from "react";
import { HEARTBEAT_MS, type PresenceEntry } from "@/features/presence/shared/presence";

// Tells the team what you're looking at and typing, and keeps a list of who's here. Sends at
// once when that changes (debounced), then every 15 s while the tab is visible.
export function usePresence(
  teamId: string,
  state: { viewing: string | null; typing: string | null },
): PresenceEntry[] {
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const { viewing, typing } = state;

  useEffect(() => {
    let cancelled = false;
    const send = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/teams/${teamId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewing, typing }),
        });
        if (!response.ok || cancelled) return;
        setPeople(((await response.json()) as { people: PresenceEntry[] }).people);
      } catch {
        // offline for a moment; the next beat catches up
      }
    };
    const soon = setTimeout(send, 400);
    const timer = setInterval(send, HEARTBEAT_MS);
    const onVisible = () => void send();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(soon);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [teamId, viewing, typing]);

  return people;
}
