"use client";

import { useCallback, useEffect, useState } from "react";
import { startNexconn } from "@/features/nexconn/client/engine";

export type ChatNotify = "all" | "mentions" | "none";

// Nexconn ChannelNoDisturbLevel values (@nexconn/chat 26.2.1).
const LEVEL: Record<ChatNotify, number> = { all: 0, mentions: 1, none: 5 };

function fromLevel(level: number): ChatNotify {
  if (level === LEVEL.none) return "none";
  if (level === LEVEL.mentions || level === 2 || level === 4) return "mentions";
  return "all";
}

// How loudly the team's chat notifies this person, as Nexconn do-not-disturb on the team's
// group. Gate alerts come through Tollgate's own system channel, so muting chat never
// silences a gate.
export function useChatNotify(channelId: string, live: string, callsEnabled: boolean) {
  const [notify, setNotify] = useState<ChatNotify | null>(null);

  useEffect(() => {
    if (live !== "live") return;
    let cancelled = false;
    void (async () => {
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const result = await new chat.GroupChannel(channelId).reload();
        if (!cancelled && result.isOk && result.data) {
          setNotify(fromLevel(result.data.noDisturbLevel));
        }
      } catch {
        // stays unknown: the menu shows without a current choice
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId, live, callsEnabled]);

  const change = useCallback(
    async (next: ChatNotify): Promise<boolean> => {
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const result = await new chat.GroupChannel(channelId).setNoDisturbLevel(
          LEVEL[next] as Parameters<InstanceType<typeof chat.GroupChannel>["setNoDisturbLevel"]>[0],
        );
        if (!result.isOk) return false;
        setNotify(next);
        return true;
      } catch {
        return false;
      }
    },
    [channelId, callsEnabled],
  );

  return { notify, change };
}
