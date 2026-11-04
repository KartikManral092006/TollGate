export const CHAT_MAX_CHARS = 500;
export const CHAT_KEEP = 200;
export const TEXT_MESSAGE_TYPE = "RC:TxtMsg";

export type ChatLine = {
  // Nexconn message id, or a temporary id while sending.
  id: string;
  senderId: string;
  text: string;
  sentTime: number;
  mine: boolean;
  local: "sending" | "failed" | null;
  // A reply on a gate card: from the message's extra, or only the code when just the
  // "TG-17 · " prefix survived (another client, or extra lost in history).
  gateId: string | null;
  gateCode: number | null;
};

// Replies start with the gate's code so they read right in any Nexconn client, and carry the
// gate's id in `extra` so they attach to the right card even if two teams share a code.
export const REPLY_PREFIX_RE = /^TG-(\d{1,7}) · /;
const GATE_ID_RE = /^[A-Za-z0-9]{32}$/;

export function replyText(code: number, text: string): string {
  return `TG-${code} · ${text}`;
}

export function replyExtra(gateId: string): string {
  return JSON.stringify({ gateId });
}

// The words of a reply without its "TG-17 · " prefix.
export function replyBody(text: string): string {
  return text.replace(REPLY_PREFIX_RE, "");
}

function gateIdFromExtra(extra: unknown): string | null {
  if (typeof extra !== "string" || extra.length > 200) return null;
  try {
    const parsed = JSON.parse(extra) as { gateId?: unknown };
    return typeof parsed.gateId === "string" && GATE_ID_RE.test(parsed.gateId)
      ? parsed.gateId
      : null;
  } catch {
    return null;
  }
}

export function normalizeChatText(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(text).slice(0, CHAT_MAX_CHARS).join("");
}

// Merges incoming lines by id, oldest first, keeping the newest CHAT_KEEP.
export function mergeChat(current: ChatLine[], incoming: ChatLine[]): ChatLine[] {
  const byId = new Map(current.map((line) => [line.id, line]));
  for (const line of incoming) byId.set(line.id, line);
  return [...byId.values()]
    .sort((a, b) => a.sentTime - b.sentTime || a.id.localeCompare(b.id))
    .slice(-CHAT_KEEP);
}

type RawMessage = {
  messageId?: string;
  messageType?: string;
  senderUserId?: string;
  sentTime?: number;
  content?: unknown;
};

// A text message from Nexconn as a chat line, or null for anything else.
export function chatLineFromMessage(message: RawMessage, selfId: string | null): ChatLine | null {
  if (message.messageType !== TEXT_MESSAGE_TYPE || !message.messageId || !message.senderUserId) {
    return null;
  }
  const content = message.content as
    { text?: unknown; content?: unknown; extra?: unknown } | null | undefined;
  const raw = typeof content?.text === "string" ? content.text : content?.content;
  if (typeof raw !== "string") return null;
  const text = normalizeChatText(raw);
  if (!text) return null;
  return {
    id: message.messageId,
    senderId: message.senderUserId,
    text,
    sentTime: message.sentTime ?? Date.now(),
    mine: message.senderUserId === selfId,
    local: null,
    gateId: gateIdFromExtra(content?.extra),
    gateCode: Number(REPLY_PREFIX_RE.exec(text)?.[1]) || null,
  };
}

// A gate's replies, oldest first: tagged with its id, or (untagged) with its code.
export function repliesTo(lines: ChatLine[], gate: { id: string; code: number }): ChatLine[] {
  return lines.filter(
    (line) =>
      line.local !== "failed" &&
      (line.gateId === gate.id || (line.gateId === null && line.gateCode === gate.code)),
  );
}
