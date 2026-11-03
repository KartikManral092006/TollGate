"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GateView } from "@/features/gates/shared/view";
import { nexconnEvents } from "@/features/nexconn/client/engine";
import { SYSTEM_USER_ID } from "@/features/nexconn/shared/config";

type Permission = "unsupported" | "default" | "granted" | "denied";

function currentPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

// Tells a voter about gates that need them: a browser notification while the tab is in the
// background, a toast while it's in front. Also shows the bot's system-channel notices (e.g.
// "TG-16 approved: retry now" for a requester).
export function useAlerts(input: {
  gates: GateView[];
  viewerId: string;
  canVote: boolean;
  teamChannelId: string;
}) {
  const { gates, viewerId, canVote, teamChannelId } = input;
  const [permission, setPermission] = useState<Permission>("unsupported");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Read after mount: the server render has no Notification API.
    const timer = setTimeout(() => setPermission(currentPermission()), 0);
    return () => clearTimeout(timer);
  }, []);

  const enable = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    if (result === "granted") toast.success("Alerts on. You'll be notified when a gate needs you.");
  }, []);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(gates.map((gate) => gate.id));
      return;
    }
    for (const gate of gates) {
      if (seen.current.has(gate.id)) continue;
      seen.current.add(gate.id);
      const needsMe =
        canVote &&
        gate.requester.id !== viewerId &&
        (gate.status === "pending" || gate.status === "parked");
      if (!needsMe) continue;
      const title = `TG-${gate.code} needs your decision`;
      const body = `${gate.requester.name}'s agent: ${gate.command}`;
      if (document.visibilityState === "hidden" && currentPermission() === "granted") {
        const notification = new Notification(title, { body, tag: gate.id });
        notification.onclick = () => {
          window.focus();
          document.getElementById(`gate-${gate.id}`)?.scrollIntoView({ block: "center" });
        };
      } else {
        toast.warning(title, { description: body, duration: 8000 });
      }
    }
  }, [gates, viewerId, canVote]);

  useEffect(
    () =>
      nexconnEvents.subscribe((event) => {
        if (event.kind !== "message") return;
        const data = event.data as {
          senderUserId?: string;
          channelId?: string;
          content?: { content?: unknown };
        };
        if (data.senderUserId !== SYSTEM_USER_ID || data.channelId === teamChannelId) return;
        const text = typeof data.content?.content === "string" ? data.content.content : null;
        // Gate notices for voters are already shown from the gate list; show the rest.
        if (!text || text.includes("needs your decision")) return;
        toast.info(text.split("\n")[0], { duration: 10_000 });
      }),
    [teamChannelId],
  );

  return { permission, enable };
}
