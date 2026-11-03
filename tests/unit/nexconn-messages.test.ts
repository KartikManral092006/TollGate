import { describe, expect, it } from "vitest";
import {
  decodeContent,
  encodeContent,
  gateCardSchema,
  gateMetadata,
  huddleMetadata,
  isValidCustomType,
  MAX_VOTE_SLOTS,
  readGateMetadata,
  TG,
  toMetadata,
} from "@/features/nexconn/shared/messages";

const card = {
  gateId: "G".repeat(32),
  code: 17,
  preset: "db-migrate",
  env: "staging",
  repo: "acme/billing",
  branch: "main",
  cmd: "npx prisma migrate deploy",
  ctx: "ALTER TABLE invoices DROP COLUMN legacy_total;",
  redactions: 1,
  quorum: 1,
  requester: "Kartik",
  requesterId: "K".repeat(32),
};

describe("message types", () => {
  it("are valid custom types", () => {
    for (const type of Object.values(TG)) expect(isValidCustomType(type)).toBe(true);
  });

  it("rejects reserved prefixes and long names", () => {
    expect(isValidCustomType("RC:TxtMsg")).toBe(false);
    expect(isValidCustomType("NC:Foo")).toBe(false);
    expect(isValidCustomType("A".repeat(33))).toBe(false);
  });
});

describe("gateCardSchema", () => {
  it("accepts a card and rejects a zero code or oversized context", () => {
    expect(gateCardSchema.safeParse(card).success).toBe(true);
    expect(gateCardSchema.safeParse({ ...card, code: 0 }).success).toBe(false);
    expect(gateCardSchema.safeParse({ ...card, ctx: "x".repeat(2049) }).success).toBe(false);
  });
});

describe("encodeContent", () => {
  it("serializes to JSON and rejects content over 10 KB", () => {
    expect(encodeContent(card)).toBe(JSON.stringify(card));
    expect(() => encodeContent({ text: "x".repeat(11 * 1024) })).toThrow();
  });

  it("counts bytes, not characters", () => {
    expect(() => encodeContent({ text: "क".repeat(4000) })).toThrow();
  });
});

describe("decodeContent", () => {
  it("accepts an object or a JSON string", () => {
    expect(decodeContent(gateCardSchema, card)).toEqual(card);
    expect(decodeContent(gateCardSchema, JSON.stringify(card))).toEqual(card);
  });

  it("returns null for invalid JSON or shape", () => {
    expect(decodeContent(gateCardSchema, "{not json")).toBeNull();
    expect(decodeContent(gateCardSchema, { gateId: "g" })).toBeNull();
  });
});

describe("gate metadata", () => {
  it("encodes state, quorum progress and votes, and reads them back", () => {
    const metadata = gateMetadata({
      status: "parked",
      approvals: 1,
      quorum: 2,
      votes: [{ userId: "ana", decision: "approve" }],
      decidedBy: null,
      grantExpiresAt: new Date(1_000),
    });
    expect(metadata).toEqual({ st: "parked", q: "1/2", v01: "ana:a", exp: "1000" });
    expect(readGateMetadata(metadata)).toEqual({
      status: "parked",
      quorum: "1/2",
      votes: [{ userId: "ana", decision: "approve" }],
    });
  });

  it("caps vote slots and never shows more approvals than the quorum", () => {
    const votes = Array.from({ length: 12 }, (_, i) => ({
      userId: `u${i}`,
      decision: "approve" as const,
    }));
    const metadata = gateMetadata({ status: "approved", approvals: 12, quorum: 2, votes });
    expect(Object.keys(metadata).filter((key) => key.startsWith("v"))).toHaveLength(MAX_VOTE_SLOTS);
    expect(metadata.q).toBe("2/2");
  });

  it("ignores unknown status and malformed vote slots", () => {
    expect(readGateMetadata({ st: "weird", v01: "nocolon", v02: "bob:d" })).toEqual({
      status: null,
      quorum: null,
      votes: [{ userId: "bob", decision: "deny" }],
    });
  });
});

describe("huddle metadata", () => {
  it("reports live state, participants and duration", () => {
    expect(huddleMetadata({ live: true, participants: 2 })).toEqual({ st: "live", n: "2" });
    expect(huddleMetadata({ live: false, participants: 3, durationSec: 84 })).toEqual({
      st: "ended",
      n: "3",
      dur: "84",
    });
  });
});

describe("toMetadata", () => {
  it("rejects keys outside the allowed charset", () => {
    expect(() => toMetadata({ "bad key": 1 })).toThrow();
    expect(() => toMetadata({ ["k".repeat(33)]: 1 })).toThrow();
  });
});
