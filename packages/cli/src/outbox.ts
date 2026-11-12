import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Reports that must reach the team even when the server can't be reached right now: a bypass
// is queued here by the hook before the call (never waiting on the network in an emergency)
// and sent by the after-the-call hook, which retries on later calls until the server has it.

export type OutboxItem = {
  kind: "bypass";
  repoRoot: string;
  server: string;
  // When it was queued (ms since epoch).
  at: number;
  body: Record<string, unknown>;
};

export const OUTBOX_MAX = 200;
// Older than this and the server would date it "now" anyway; it has had a week of retries.
export const OUTBOX_TTL_MS = 7 * 86_400_000;

export type SendResult = "sent" | "retry" | "drop";

function outboxFile(home: string): string {
  return join(home, "outbox.jsonl");
}

export function readOutbox(home: string): OutboxItem[] {
  let text: string;
  try {
    text = readFileSync(outboxFile(home), "utf8");
  } catch {
    return [];
  }
  return text.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const item = JSON.parse(line) as OutboxItem;
      return item && item.kind === "bypass" && item.body ? [item] : [];
    } catch {
      return [];
    }
  });
}

function writeOutbox(home: string, items: OutboxItem[]): void {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const file = outboxFile(home);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, items.map((item) => `${JSON.stringify(item)}\n`).join(""), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}

export function addToOutbox(home: string, item: OutboxItem): void {
  writeOutbox(home, [...readOutbox(home), item].slice(-OUTBOX_MAX));
}

// Sends what's queued, oldest first, keeping only what should be tried again. Reports carry
// their own id, so one sent twice by two hooks at once is still recorded once.
export async function flushOutbox(
  home: string,
  send: (item: OutboxItem) => Promise<SendResult>,
  now: number,
): Promise<{ sent: number; kept: number }> {
  const items = readOutbox(home);
  if (items.length === 0) return { sent: 0, kept: 0 };
  const kept: OutboxItem[] = [];
  let sent = 0;
  for (const item of items) {
    if (now - item.at > OUTBOX_TTL_MS) continue;
    let result: SendResult;
    try {
      result = await send(item);
    } catch {
      result = "retry";
    }
    if (result === "sent") sent += 1;
    if (result === "retry") kept.push(item);
  }
  // Something may have been queued while sending: keep it too.
  const seen = new Set(items.map((item) => item.body.id));
  const queuedMeanwhile = readOutbox(home).filter((item) => !seen.has(item.body.id));
  writeOutbox(home, [...kept, ...queuedMeanwhile]);
  return { sent, kept: kept.length + queuedMeanwhile.length };
}
