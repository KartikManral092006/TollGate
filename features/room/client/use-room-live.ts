"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeGates, type GateView } from "@/features/gates/shared/view";
import {
  getReceivedMessage,
  nexconnEvents,
  startNexconn,
  type ChatMessage,
} from "@/features/nexconn/client/engine";
import { TG } from "@/features/nexconn/shared/messages";
import {
  chatLineFromMessage,
  mergeChat,
  MENTION_PEOPLE,
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
  // The SDK's own message objects (history and your sends): editing and deleting need them.
  const messages = useRef(new Map<string, ChatMessage>());
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
      if (event.kind === "receipt") {
        const { messageId, users } = event.data as { messageId: string; users: string[] };
        setLines((current) =>
          current.map((line) =>
            line.id === messageId
              ? { ...line, readBy: [...new Set([...line.readBy, ...users])] }
              : line,
          ),
        );
        return;
      }
      if (event.kind === "messageUpdated") {
        const updated = chatLineFromMessage(
          event.data as Parameters<typeof chatLineFromMessage>[0],
          selfRef.current,
        );
        if (updated) {
          setLines((current) =>
            current.map((line) =>
              line.id === updated.id ? { ...updated, readBy: line.readBy } : line,
            ),
          );
        }
        return;
      }
      if (event.kind === "messageDeleted") {
        const { messageId } = event.data as { messageId: string };
        setLines((current) => current.filter((line) => line.id !== messageId));
        return;
      }
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
        for (const message of result.data.data) {
          messages.current.set(message.messageId, message as ChatMessage);
        }
        const history = result.data.data
          .map((message) => chatLineFromMessage(message, session.userId))
          .filter((line): line is ChatLine => line !== null);
        setLines((current) => mergeChat(current, history));

        // Who has read your recent @mentions: only the sender may ask, which is you.
        const mine = history.filter((line) => line.mine && line.mentions.length > 0).slice(-10);
        for (const line of mine) {
          const readers = await chat.BaseChannel.createMessagesReadReceiptUsersQuery({
            channelIdentifier: new chat.GroupChannelIdentifier(channelId),
            messageId: line.id,
            pageSize: 50,
            status: chat.MessageReadReceiptStatus.RESPONDED,
          })
            .loadNextPage()
            .catch(() => null);
          if (cancelled) return;
          const users = readers?.isOk ? (readers.data?.data ?? []).map((u) => u.userId) : [];
          if (users.length > 0) {
            setLines((current) =>
              current.map((l) => (l.id === line.id ? { ...l, readBy: users } : l)),
            );
          }
        }
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
    // With `mention`, the people it @mentions get a push and the sender sees who read it.
    async (
      raw: string,
      gate?: { id: string; code: number },
      mention?: { ids: string[]; from: string },
      // Only these members receive it (the team without its clients).
      onlyTo?: string[],
    ): Promise<boolean> => {
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
        mentions: mention?.ids ?? [],
        readBy: [],
        teamOnly: Boolean(onlyTo?.length),
        edited: false,
        attachment: null,
      };
      setLines((current) => mergeChat(current, [optimistic]));
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const channel = new chat.GroupChannel(channelId);
        const params = new chat.SendTextMessageParams({
          text,
          ...(gate ? { extra: replyExtra(gate.id) } : {}),
          ...(mention?.ids.length
            ? { mentionedInfo: { type: MENTION_PEOPLE, userIdList: mention.ids } }
            : {}),
        });
        if (onlyTo?.length) params.directedUserIds = onlyTo;
        if (mention?.ids.length) {
          params.needReceipt = true;
          params.pushConfig = {
            pushTitle: `${mention.from} mentioned you`,
            pushContent: Array.from(text).slice(0, 120).join(""),
            pushData: "",
          };
        }
        const result = await channel.sendMessage(params);
        if (!result.isOk || !result.data) throw new Error(`send failed: ${result.code}`);
        const sent = result.data;
        messages.current.set(sent.messageId, sent as unknown as ChatMessage);
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

  // A picture or file into the room (or onto a gate, like a reply). Shown while uploading;
  // the line becomes the real message once Nexconn has the file.
  const sendFile = useCallback(
    async (file: File, gate?: { id: string; code: number }): Promise<boolean> => {
      const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(file.type);
      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatLine = {
        id: tempId,
        senderId: selfRef.current ?? "me",
        text: "",
        sentTime: Date.now(),
        mine: true,
        local: "sending",
        gateId: gate?.id ?? null,
        gateCode: gate?.code ?? null,
        mentions: [],
        readBy: [],
        teamOnly: false,
        edited: false,
        attachment: isImage
          ? { kind: "image", url: "", thumb: null }
          : { kind: "file", url: "", name: file.name, size: file.size },
      };
      setLines((current) => mergeChat(current, [optimistic]));
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const extra = gate ? { extra: replyExtra(gate.id) } : {};
        const channel = new chat.GroupChannel(channelId);
        let result;
        if (isImage) {
          const params = new chat.SendImageMessageParams({
            thumbnailBase64: await thumbnail(file),
            remoteUrl: "",
            ...extra,
          });
          params.file = file;
          result = await channel.sendMediaMessage(params);
        } else {
          const params = new chat.SendFileMessageParams({
            name: file.name.slice(0, 120),
            size: file.size,
            fileType: file.name.split(".").pop()?.toLowerCase() ?? "",
            remoteUrl: "",
            ...extra,
          });
          params.file = file;
          result = await channel.sendMediaMessage(params);
        }
        if (!result.isOk || !result.data) throw new Error(`upload failed: ${result.code}`);
        const sent = result.data as unknown as ChatMessage;
        messages.current.set(sent.messageId, sent);
        const line = chatLineFromMessage(sent, selfRef.current);
        setLines((current) =>
          mergeChat(
            current.filter((l) => l.id !== tempId),
            line ? [line] : [],
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

  function withoutText(content: Record<string, unknown>) {
    const { text: _text, ...rest } = content;
    return rest;
  }

  // Your own message, changed for everyone. Its gate prefix, gate tag and mentions are kept.
  const edit = useCallback(
    async (messageId: string, raw: string): Promise<boolean> => {
      const message = messages.current.get(messageId) ?? getReceivedMessage(messageId);
      const line = lines.find((l) => l.id === messageId);
      const body = normalizeChatText(raw);
      if (!message || !line || !body) return false;
      const text = normalizeChatText(line.gateCode ? replyText(line.gateCode, body) : body);
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const result = await chat.BaseChannel.updateMessage({
          messageId,
          // The engine's field name: with `text` (what sending takes) the edit saves as empty.
          content: { ...withoutText(message.content), content: text },
          channelIdentifier: new chat.GroupChannelIdentifier(channelId),
        });
        if (!result.isOk) return false;
        setLines((current) =>
          current.map((l) => (l.id === messageId ? { ...l, text, edited: true } : l)),
        );
        return true;
      } catch {
        return false;
      }
    },
    [lines, channelId, callsEnabled],
  );

  // Your own message, deleted for everyone (it's gone from history too).
  const remove = useCallback(
    async (messageId: string): Promise<boolean> => {
      const message = messages.current.get(messageId) ?? getReceivedMessage(messageId);
      if (!message) return false;
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const result = await new chat.GroupChannel(channelId).deleteMessageForAll(message);
        if (!result.isOk) return false;
        messages.current.delete(messageId);
        setLines((current) => current.filter((l) => l.id !== messageId));
        return true;
      } catch {
        return false;
      }
    },
    [channelId, callsEnabled],
  );

  return { gates, lines, live, selfNexconnId, refresh, send, sendFile, edit, remove, setGates };
}

// A small JPEG preview (base64, no data: prefix) that Nexconn carries inside the message,
// so the picture shows before the full image loads.
async function thumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.6).split(",")[1] ?? "";
}
