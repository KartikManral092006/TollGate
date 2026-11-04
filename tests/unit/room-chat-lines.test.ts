import { describe, expect, it } from "vitest";
import {
  CHAT_KEEP,
  CHAT_MAX_CHARS,
  chatLineFromMessage,
  mergeChat,
  normalizeChatText,
  mentionedIds,
  repliesTo,
  replyBody,
  replyExtra,
  replyText,
  type ChatLine,
} from "@/features/room/shared/chat";

const line = (id: string, sentTime: number, overrides: Partial<ChatLine> = {}): ChatLine => ({
  id,
  senderId: "u",
  text: id,
  sentTime,
  mine: false,
  local: null,
  gateId: null,
  gateCode: null,
  mentions: [],
  readBy: [],
  teamOnly: false,
  edited: false,
  ...overrides,
});

describe("normalizeChatText", () => {
  it("trims, drops control characters and caps the length", () => {
    expect(normalizeChatText("  hi\u0000 there \n\n\n\n ok ")).toBe("hi  there \n\n ok");
    expect(Array.from(normalizeChatText("😀".repeat(CHAT_MAX_CHARS + 10)))).toHaveLength(
      CHAT_MAX_CHARS,
    );
  });
});

describe("mergeChat", () => {
  it("orders by time and de-duplicates by id", () => {
    const merged = mergeChat(
      [line("b", 2), line("a", 1)],
      [line("b", 2, { text: "B2" }), line("c", 3)],
    );
    expect(merged.map((l) => [l.id, l.text])).toEqual([
      ["a", "a"],
      ["b", "B2"],
      ["c", "c"],
    ]);
  });

  it("keeps only the newest messages", () => {
    const many = Array.from({ length: CHAT_KEEP + 5 }, (_, i) => line(`m${i}`, i));
    const merged = mergeChat([], many);
    expect(merged).toHaveLength(CHAT_KEEP);
    expect(merged[0]?.id).toBe("m5");
  });
});

describe("mentionedIds", () => {
  it("keeps only picked names still written in the text", () => {
    const picked = new Map([
      ["Ana Ruiz", "ana"],
      ["Ben Okafor", "ben"],
    ]);
    expect(mentionedIds("@Ana Ruiz does billing read it?", picked)).toEqual(["ana"]);
    expect(mentionedIds("nobody", picked)).toEqual([]);
  });
});

describe("repliesTo", () => {
  const gate = { id: "B".repeat(32), code: 9 };
  it("collects tagged replies, and untagged ones by code, but not other gates' or failed ones", () => {
    const lines = [
      line("a", 1, { gateId: gate.id, gateCode: 9 }),
      line("b", 2, { gateCode: 9 }),
      line("c", 3, { gateId: "C".repeat(32), gateCode: 9 }),
      line("d", 4),
      line("e", 5, { gateId: gate.id, gateCode: 9, local: "failed" }),
    ];
    expect(repliesTo(lines, gate).map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("chatLineFromMessage", () => {
  const message = {
    messageId: "nx1",
    messageType: "RC:TxtMsg",
    senderUserId: "U1",
    sentTime: 1000,
    content: { text: "  hello  " },
  };

  it("turns a text message into a chat line", () => {
    expect(chatLineFromMessage(message, "me")).toEqual({
      id: "nx1",
      senderId: "U1",
      text: "hello",
      sentTime: 1000,
      mine: false,
      local: null,
      gateId: null,
      gateCode: null,
      mentions: [],
      readBy: [],
      teamOnly: false,
      edited: false,
    });
    expect(
      chatLineFromMessage(
        { ...message, updateInfo: { content: { text: "fixed typo" }, status: 0, timestamp: 2 } },
        "me",
      ),
    ).toMatchObject({ text: "fixed typo", edited: true });
    expect(chatLineFromMessage({ ...message, directedUserIds: ["U1", "U2"] }, "me")?.teamOnly).toBe(
      true,
    );
    expect(chatLineFromMessage(message, "U1")?.mine).toBe(true);
  });

  it("reads who a message @mentions", () => {
    const mention = chatLineFromMessage(
      {
        ...message,
        content: {
          text: "@Ana Ruiz can you look?",
          mentionedInfo: { type: 2, userIdList: ["ana", 7] },
        },
      },
      "me",
    );
    expect(mention?.mentions).toEqual(["ana"]);
  });

  const GATE = "A".repeat(32);

  it("attaches a reply to its gate by the id in extra", () => {
    const reply = chatLineFromMessage(
      {
        ...message,
        content: { text: replyText(17, "does billing read it?"), extra: replyExtra(GATE) },
      },
      "me",
    );
    expect(reply).toMatchObject({
      gateId: GATE,
      gateCode: 17,
      text: "TG-17 · does billing read it?",
    });
    expect(replyBody(reply!.text)).toBe("does billing read it?");
  });

  it("falls back to the code prefix when extra is missing or not ours", () => {
    for (const extra of [
      undefined,
      "not json",
      JSON.stringify({ gateId: "short" }),
      "x".repeat(300),
    ]) {
      const reply = chatLineFromMessage(
        { ...message, content: { text: "TG-4 · yes, nightly", extra } },
        "me",
      );
      expect(reply).toMatchObject({ gateId: null, gateCode: 4 });
    }
    expect(
      chatLineFromMessage({ ...message, content: { text: "TG-4 is fine" } }, "me")?.gateCode,
    ).toBeNull();
  });

  it.each([
    ["a doubt (MG:Moment)", { messageType: "MG:Moment" }],
    ["an empty text", { content: { text: "   " } }],
    ["a missing sender", { senderUserId: undefined }],
    ["a non-text content", { content: { text: 42 } }],
  ])("ignores %s", (_label, overrides) => {
    expect(chatLineFromMessage({ ...message, ...overrides }, "me")).toBeNull();
  });
});
