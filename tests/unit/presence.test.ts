import { describe, expect, it } from "vitest";
import { FRESH_MS, freshPresence, presenceFor } from "@/features/presence/shared/presence";

const G = "G".repeat(32);
const H = "H".repeat(32);

describe("freshPresence", () => {
  it("keeps fresh entries and marks stale or broken ones for deletion", () => {
    const now = 1_000_000;
    const { people, stale } = freshPresence(
      {
        ana: JSON.stringify({ viewing: G, typing: null, at: now - 1000 }),
        raj: JSON.stringify({ viewing: G, typing: null, at: now - FRESH_MS - 1 }),
        bad: "{not json",
        old: JSON.stringify({ viewing: G }),
      },
      now,
    );
    expect(people).toEqual([{ userId: "ana", viewing: G, typing: null }]);
    expect(stale.sort()).toEqual(["bad", "old", "raj"]);
  });
});

describe("presenceFor", () => {
  const people = [
    { userId: "me", viewing: G, typing: null },
    { userId: "ana", viewing: G, typing: null },
    { userId: "raj", viewing: G, typing: G },
    { userId: "lee", viewing: H, typing: null },
  ];

  it("lists others looking and typing on this gate, typing taking precedence", () => {
    expect(presenceFor(G, people, "me")).toEqual({ looking: ["ana"], typing: ["raj"] });
    expect(presenceFor(H, people, "me")).toEqual({ looking: ["lee"], typing: [] });
  });
});
