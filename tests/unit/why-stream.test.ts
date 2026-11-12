import { describe, expect, it, vi } from "vitest";
import type { NexconnClient } from "@/features/nexconn/server/client";
import { streamWhyToRoom } from "@/features/why/server/share";
import { WHY_STREAM_MAX_CHUNKS, whyChunks } from "@/features/why/shared/stream";

vi.mock("server-only", () => ({}));

describe("whyChunks", () => {
  it("splits into sentences and lines that join back into the text exactly", () => {
    const text = "Deploys to production. Customers see it at once!\nReversible by redeploying.";
    const chunks = whyChunks(text);
    expect(chunks.length).toBe(3);
    expect(chunks.join("")).toBe(text);
  });

  it("merges a long explanation into at most the maximum number of chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence ${i}.`).join(" ");
    const chunks = whyChunks(text);
    expect(chunks.length).toBeLessThanOrEqual(WHY_STREAM_MAX_CHUNKS);
    expect(chunks.join("")).toBe(text);
  });

  it("handles text without punctuation and empty text", () => {
    expect(whyChunks("no full stop here")).toEqual(["no full stop here"]);
    expect(whyChunks("")).toEqual([]);
  });
});

describe("streamWhyToRoom", () => {
  const input = {
    channelId: "tgTEAM",
    gateId: "g".repeat(32),
    code: 42,
    sharedBy: "Arjun",
    text: "One. Two. Three.",
  };

  it("sends numbered chunks linked by the first chunk's id, completing on the last", async () => {
    const call = vi.fn(async () => ({ messageId: "M1" }));
    const sleep = vi.fn(async () => undefined);
    const id = await streamWhyToRoom(
      { client: { call } as unknown as NexconnClient, sleep },
      input,
    );
    expect(id).toBe("M1");
    const bodies = call.mock.calls.map((args) => (args as unknown[])[1] as { content: Record<string, unknown> } & Record<string, unknown>);
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toMatchObject({
      fromUserId: "tollgatebot",
      toChannelId: "tgTEAM",
      messageType: "RC:StreamMsg",
      content: {
        content: "One. ",
        seq: 1,
        complete: false,
        type: "text",
        extra: { gateId: input.gateId, code: "42", by: "Arjun" },
      },
    });
    expect(bodies[0]!.content.messageId).toBeUndefined();
    expect(bodies[1]!.content).toMatchObject({ seq: 2, complete: false, messageId: "M1" });
    expect(bodies[2]!.content).toMatchObject({ seq: 3, complete: true, messageId: "M1" });
    expect(bodies[1]!.content.extra).toBeUndefined();
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("stops after the first chunk if Nexconn returns no message id", async () => {
    const call = vi.fn(async () => ({}));
    const id = await streamWhyToRoom(
      { client: { call } as unknown as NexconnClient, sleep: async () => undefined },
      input,
    );
    expect(id).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });
});
