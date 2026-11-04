"use client";

import { useEffect, useMemo, useState } from "react";
import { nexconnEvents, startNexconn } from "@/features/nexconn/client/engine";

// Subscriptions last this long; renewed well before they lapse while the room stays open.
const EXPIRY_SEC = 3600;
const RENEW_MS = 50 * 60_000;

// Teammates connected to Nexconn anywhere in Tollgate (another team's room, review mode, a
// phone), from Nexconn's online-status subscription. Room presence (Redis) only knows who
// has this room open; together they answer "who can I reach right now?".
export function useNexconnOnline({
  userIds,
  live,
  callsEnabled,
}: {
  userIds: string[];
  live: "live" | "connecting" | "offline";
  callsEnabled: boolean;
}): Set<string> {
  // userId → platforms it's online on (web, iOS, …).
  const [platforms, setPlatforms] = useState<Map<string, Set<number>>>(new Map());
  const key = [...userIds].sort().join(",");

  useEffect(() => {
    if (live !== "live" || !key) return;
    const ids = key.split(",");
    let cancelled = false;
    const subscribe = async () => {
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const users = chat.NCEngine.userModule;
        await users.subscribeEvent({
          subscribeType: chat.SubscribeType.ONLINE_STATUS,
          userIds: ids,
          expiry: EXPIRY_SEC,
        });
        const status = await users.getSubscribeUsersOnlineStatus(ids);
        if (cancelled || !status.isOk || !status.data) return;
        setPlatforms(
          new Map(
            status.data.map((user) => [
              user.userId,
              new Set(user.details.filter((d) => d.isOnline).map((d) => d.platform)),
            ]),
          ),
        );
      } catch {
        // room presence still works without it
      }
    };
    void subscribe();
    const timer = setInterval(() => void subscribe(), RENEW_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, live, callsEnabled]);

  useEffect(
    () =>
      nexconnEvents.subscribe((event) => {
        if (event.kind !== "onlineStatus") return;
        const { userId, platform, online } = event.data as {
          userId: string;
          platform: number;
          online: boolean;
        };
        setPlatforms((current) => {
          const next = new Map(current);
          const set = new Set(next.get(userId) ?? []);
          if (online) set.add(platform);
          else set.delete(platform);
          next.set(userId, set);
          return next;
        });
      }),
    [],
  );

  return useMemo(
    () => new Set([...platforms].filter(([, set]) => set.size > 0).map(([id]) => id)),
    [platforms],
  );
}
