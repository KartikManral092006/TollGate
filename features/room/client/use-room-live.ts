"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeGates, type GateView } from "@/features/gates/shared/view";
import { nexconnEvents, startNexconn } from "@/features/nexconn/client/engine";
import { TG } from "@/features/nexconn/shared/messages";
import {
  chatLineFromMessage,
  mergeChat,
  normalizeChatText,
  replyExtra,
  replyText,
  type ChatLine,
} from "@/features/room/shared/chat";

export type LiveState = "connecting" | "live" | "offline";

const HISTORY_SIZE = 50;
const POLL_OFFLINE_MS = 4000;
const POLL_LIVE_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 150;

// Postgres is the truth for gates; Nexconn makes the room live. Any TG:* message or metadata
// change on this team's channel triggers a refetch of the gate list, so a missed or
// out-of-order event can never leave a card wrong for long. Without Nexconn (not configured,
// blocked network) the room keeps working by polling.
export function useRoomLive(input: {
  teamId: string;
  channelId: string;
  initialGates: GateView[];
  callsEnabled: boolean;
}) {
  const { teamId, channelId, callsEnabled } = input;
  const [gates, setGates] = useState(input.initialGates);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [live, setLive] = useState<LiveState>("connecting");
  const [selfNexconnId, setSelfNexconnId] = useState<string | null>(null);
  const selfRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/gates`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { gates: GateView[] };
      setGates((current) => mergeGates(current, body.gates));
    } catch {
      // offline for a moment; the next poll or event catches up
    }
  }, [teamId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = nexconnEvents.subscribe((event) => {
      if (event.kind === "connection") {
        const { status } = event.data as { status: number };
        // RCConnectionStatus.CONNECTED = 0 (@nexconn/engine 26.2.1).
        setLive(status === 0 ? "live" : "connecting");
        return;
      }
      const data = event.data as { channelId?: string; messageType?: string };
      if (data.channelId !== channelId) return;
      if (event.kind === "metadataUpdated") {
        scheduleRefresh();
        return;
      }
      if (event.kind !== "message") return;
      if (data.messageType === TG.Gate || data.messageType === TG.Huddle) {
        scheduleRefresh();
        return;
      }
      const line = chatLineFromMessage(
        event.data as Parameters<typeof chatLineFromMessage>[0],
        selfRef.current,
      );
      if (line) setLines((current) => mergeChat(current, [line]));
    });

    (async () => {
      try {
        const joined = await fetch(`/api/teams/${teamId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!joined.ok) throw new Error(`chat ${joined.status}`);
        const session = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        if (cancelled) return;
        selfRef.current = session.userId;
        setSelfNexconnId(session.userId);
        setLive("live");

        const { chat } = session;
        const query = chat.BaseChannel.createMessagesQuery({
          channelIdentifier: new chat.GroupChannelIdentifier(channelId),
          pageSize: HISTORY_SIZE,
        });
        const result = await query.loadNextPage();
        if (cancelled || !result.isOk || !result.data) return;
        const history = result.data.data
          .map((message) => chatLineFromMessage(message, session.userId))
          .filter((line): line is ChatLine => line !== null);
        setLines((current) => mergeChat(current, history));
      } catch {
        if (!cancelled) setLive("offline");
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [teamId, channelId, callsEnabled, scheduleRefresh]);

  useEffect(() => {
    const every = live === "live" ? POLL_LIVE_MS : POLL_OFFLINE_MS;
    const timer = setInterval(() => void refresh(), every);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, refresh]);

  const send = useCallback(
    // With `gate`, a reply on that gate's card: prefixed with its code, tagged with its id.
    async (raw: string, gate?: { id: string; code: number }): Promise<boolean> => {
      const body = normalizeChatText(raw);
      if (!body) return false;
      const text = gate ? normalizeChatText(replyText(gate.code, body)) : body;
      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatLine = {
        id: tempId,
        senderId: selfRef.current ?? "me",
        text,
        sentTime: Date.now(),
        mine: true,
        local: "sending",
        gateId: gate?.id ?? null,
        gateCode: gate?.code ?? null,
      };
      setLines((current) => mergeChat(current, [optimistic]));
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const channel = new chat.GroupChannel(channelId);
        const result = await channel.sendMessage(
          new chat.SendTextMessageParams(gate ? { text, extra: replyExtra(gate.id) } : { text }),
        );
        if (!result.isOk || !result.data) throw new Error(`send failed: ${result.code}`);
        const sent = result.data;
        setLines((current) =>
          mergeChat(
            current.filter((line) => line.id !== tempId),
            [{ ...optimistic, id: sent.messageId, sentTime: sent.sentTime, local: null }],
          ),
        );
        return true;
      } catch {
        setLines((current) =>
          current.map((line) => (line.id === tempId ? { ...line, local: "failed" } : line)),
        );
        return false;
      }
    },
    [channelId, callsEnabled],
  );

  return { gates, lines, live, selfNexconnId, refresh, send, setGates };
}
