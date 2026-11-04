"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { startNexconn } from "@/features/nexconn/client/engine";
import { replyBody, type ChatLine } from "@/features/room/shared/chat";

// Messages that @mention you: acknowledged with a Nexconn read receipt once the room is on
// screen (so the sender sees "Read by you"), and a new one arriving now shows a toast.
export function useMentionReceipts({
  lines,
  selfId,
  channelId,
  live,
  callsEnabled,
  nameOf,
}: {
  lines: ChatLine[];
  selfId: string | null;
  channelId: string;
  live: "live" | "connecting" | "offline";
  callsEnabled: boolean;
  nameOf: (nexconnId: string) => string;
}) {
  const acked = useRef(new Set<string>());
  // When this room opened (set on mount): older mentions are acknowledged without a toast.
  const since = useRef<number | null>(null);
  useEffect(() => {
    since.current = Date.now();
  }, []);

  useEffect(() => {
    if (!selfId || live !== "live") return;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      const fresh = lines.filter(
        (line) => !line.mine && line.mentions.includes(selfId) && !acked.current.has(line.id),
      );
      if (fresh.length === 0) return;
      for (const line of fresh) {
        acked.current.add(line.id);
        if (since.current !== null && line.sentTime > since.current) {
          toast(`${nameOf(line.senderId)} mentioned you`, {
            description: replyBody(line.text).slice(0, 140),
          });
        }
      }
      void (async () => {
        try {
          const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
          await new chat.GroupChannel(channelId).sendReadReceiptResponse(
            fresh.map((line) => line.id),
          );
        } catch {
          for (const line of fresh) acked.current.delete(line.id);
        }
      })();
    };
    send();
    document.addEventListener("visibilitychange", send);
    return () => document.removeEventListener("visibilitychange", send);
  }, [lines, selfId, channelId, live, callsEnabled, nameOf]);
}
