import "server-only";
import type { NexconnClient } from "@/features/nexconn/server/client";
import { sendGroupStreamChunk } from "@/features/nexconn/server/api";
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from "@/features/nexconn/shared/config";
import { whyChunks } from "@/features/why/shared/stream";

// The pause between chunks: long enough to read along as it arrives, at most a few seconds
// for a whole explanation.
export const WHY_STREAM_PAUSE_MS = 250;

export type ShareDeps = {
  client: NexconnClient;
  sleep: (ms: number) => Promise<void>;
};

// Posts an explanation into the team's room as a Nexconn stream message from the Tollgate
// bot: the first chunk carries the gate and who shared it; the last one completes the stream.
// The bot sends through the server API and never connects, so it adds no active user.
export async function streamWhyToRoom(
  deps: ShareDeps,
  input: { channelId: string; gateId: string; code: number; sharedBy: string; text: string },
): Promise<string | null> {
  const chunks = whyChunks(input.text);
  if (chunks.length === 0) return null;
  let messageId: string | undefined;
  for (const [index, content] of chunks.entries()) {
    const first = index === 0;
    const complete = index === chunks.length - 1;
    const sent = await sendGroupStreamChunk(deps.client, {
      fromUserId: SYSTEM_USER_ID,
      toChannelId: input.channelId,
      content: {
        content,
        seq: index + 1,
        complete,
        ...(first
          ? {
              type: "text" as const,
              user: { id: SYSTEM_USER_ID, name: SYSTEM_USER_NAME },
              extra: { gateId: input.gateId, code: String(input.code), by: input.sharedBy },
            }
          : { messageId }),
      },
    });
    if (first) {
      messageId = sent.messageId;
      // Without the first chunk's id the rest can't be attached; stop rather than orphan them.
      if (!messageId) return null;
    }
    if (!complete) await deps.sleep(WHY_STREAM_PAUSE_MS);
  }
  return messageId ?? null;
}
