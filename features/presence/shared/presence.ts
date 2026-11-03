import { z } from "zod";

// Who is in a team's room right now and what they're doing, from short heartbeats. Server
// state lives in one Redis hash per team; an entry older than FRESH_MS is someone who left.

export const FRESH_MS = 35_000;
export const HEARTBEAT_MS = 15_000;

const GATE_ID = /^[A-Za-z0-9]{32}$/;

export const presenceSchema = z
  .object({
    viewing: z.string().regex(GATE_ID).nullable(),
    typing: z.string().regex(GATE_ID).nullable(),
  })
  .strict();

export type PresenceEntry = { userId: string; viewing: string | null; typing: string | null };

// Parses the hash, keeping only fresh, well-formed entries. Stale ones are returned
// separately so the server can delete them.
export function freshPresence(
  raw: Record<string, string>,
  now: number,
): { people: PresenceEntry[]; stale: string[] } {
  const people: PresenceEntry[] = [];
  const stale: string[] = [];
  for (const [userId, value] of Object.entries(raw)) {
    try {
      const entry = JSON.parse(value) as { viewing?: unknown; typing?: unknown; at?: unknown };
      if (typeof entry.at !== "number" || now - entry.at > FRESH_MS) {
        stale.push(userId);
        continue;
      }
      people.push({
        userId,
        viewing: typeof entry.viewing === "string" ? entry.viewing : null,
        typing: typeof entry.typing === "string" ? entry.typing : null,
      });
    } catch {
      stale.push(userId);
    }
  }
  return { people, stale };
}

// What a gate shows: who else is looking at it and who is writing a reason or question.
export function presenceFor(
  gateId: string,
  people: PresenceEntry[],
  viewerId: string,
): { looking: string[]; typing: string[] } {
  const others = people.filter((p) => p.userId !== viewerId);
  return {
    typing: others.filter((p) => p.typing === gateId).map((p) => p.userId),
    looking: others.filter((p) => p.viewing === gateId && p.typing !== gateId).map((p) => p.userId),
  };
}
