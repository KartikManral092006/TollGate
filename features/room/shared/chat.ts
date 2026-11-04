export const CHAT_MAX_CHARS = 500;
export const CHAT_KEEP = 200;
export const TEXT_MESSAGE_TYPE = "RC:TxtMsg";
export const IMAGE_MESSAGE_TYPE = "RC:ImgMsg";
export const FILE_MESSAGE_TYPE = "RC:FileMsg";

// A picture or file sent into the room. Links are only ever https (a client could send
// anything), and the thumbnail is plain base64.
export type Attachment =
  | { kind: "image"; url: string; thumb: string | null }
  | { kind: "file"; url: string; name: string; size: number };

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
  // Nexconn user ids @mentioned in it (mentionedInfo), and, on your own messages that
  // mention someone, who has read it so far (read receipts).
  mentions: string[];
  readBy: string[];
  // Sent to some members only (Nexconn directedUserIds): the team, without its clients.
  teamOnly: boolean;
  // Changed by its sender after sending.
  edited: boolean;
  attachment: Attachment | null;
};

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function attachmentFrom(type: string | undefined, content: Record<string, unknown> | null) {
  if (!content) return null;
  if (type === IMAGE_MESSAGE_TYPE) {
    const url = safeUrl(content.remoteUrl ?? content.imageUri);
    if (!url) return null;
    const thumb = content.thumbnailBase64 ?? content.content;
    return {
      kind: "image" as const,
      url,
      thumb:
        typeof thumb === "string" && thumb.length < 200_000 && /^[A-Za-z0-9+/=]+$/.test(thumb)
          ? thumb
          : null,
    };
  }
  if (type === FILE_MESSAGE_TYPE) {
    const url = safeUrl(content.remoteUrl ?? content.fileUrl);
    if (!url) return null;
    return {
      kind: "file" as const,
      url,
      name: normalizeChatText(typeof content.name === "string" ? content.name : "file").slice(
        0,
        120,
      ),
      size: typeof content.size === "number" ? content.size : 0,
    };
  }
  return null;
}

// Nexconn's MentionedType.SINGAL: specific people (the enum isn't exported at runtime).
export const MENTION_PEOPLE = 2;

// The @mentions kept in a message: picked names whose "@Name" is still in the text.
export function mentionedIds(text: string, picked: Map<string, string>): string[] {
  return [...picked.entries()].filter(([name]) => text.includes(`@${name}`)).map(([, id]) => id);
}

function mentionsFrom(info: unknown): string[] {
  const list = (info as { userIdList?: unknown } | null | undefined)?.userIdList;
  return Array.isArray(list)
    ? list.filter((id): id is string => typeof id === "string").slice(0, 50)
    : [];
}

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
  directedUserIds?: unknown;
  // Set once a message has been edited: its newest content.
  updateInfo?: unknown;
  hasChanged?: unknown;
};

// A text, picture or file message from Nexconn as a chat line, or null for anything else.
export function chatLineFromMessage(message: RawMessage, selfId: string | null): ChatLine | null {
  if (!message.messageId || !message.senderUserId) return null;
  const content = message.content as
    | { text?: unknown; content?: unknown; extra?: unknown; mentionedInfo?: unknown }
    | null
    | undefined;
  const base = {
    id: message.messageId,
    senderId: message.senderUserId,
    sentTime: message.sentTime ?? Date.now(),
    mine: message.senderUserId === selfId,
    local: null,
    gateId: gateIdFromExtra(content?.extra),
    mentions: [],
    readBy: [],
    teamOnly: Array.isArray(message.directedUserIds) && message.directedUserIds.length > 0,
    edited: false,
  };
  const attachment = attachmentFrom(
    message.messageType,
    (content ?? null) as Record<string, unknown> | null,
  );
  // A picture or file attached to a gate carries the gate's id in extra, like a reply.
  if (attachment) return { ...base, text: "", gateCode: null, attachment };
  if (message.messageType !== TEXT_MESSAGE_TYPE) return null;
  const updated = (message.updateInfo as { content?: { text?: unknown; content?: unknown } } | null)
    ?.content;
  const newest = updated?.text ?? updated?.content;
  const raw =
    typeof newest === "string"
      ? newest
      : typeof content?.text === "string"
        ? content.text
        : content?.content;
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
    mentions: mentionsFrom(content?.mentionedInfo),
    readBy: [],
    teamOnly: Array.isArray(message.directedUserIds) && message.directedUserIds.length > 0,
    edited: typeof newest === "string" || message.hasChanged === true,
    attachment: null,
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
