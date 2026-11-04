import { describe, expect, it } from "vitest";
import type { GateView } from "@/features/gates/shared/view";
import { timeline } from "@/features/room/components/gate-page-client";

const at = (min: number) => new Date(Date.UTC(2026, 10, 4, 9, min)).toISOString();

function gate(patch: Partial<GateView>): GateView {
  return {
    id: "g",
    code: 7,
    status: "pending",
    preset: "db-migrate",
    tool: "bash",
    env: "prod",
    repo: "acme/x",
    mode: "guard",
    branch: "main",
    command: "npx prisma migrate deploy",
    context: "",
    intent: null,
    via: null,
    redactions: 0,
    quorum: 1,
    approvals: 0,
    requester: { id: "r", name: "Kartik" },
    votes: [],
    denyReason: null,
    question: null,
    followUp: null,
    answeredIn: null,
    rule: null,
    decidedAt: null,
    parksAt: null,
    parkedAt: null,
    grant: null,
    calls: [],
    createdAt: at(0),
    ...patch,
  };
}

describe("timeline", () => {
  it("orders what happened, parking and the retry included", () => {
    const events = timeline(
      gate({
        status: "approved",
        parkedAt: at(5),
        votes: [{ userId: "a", name: "Ana", decision: "approve", reason: null, at: at(40) }],
        grant: { expiresAt: at(2000), usedAt: at(45) },
      }),
    );
    expect(events.map((e) => e.text)).toEqual([
      "Kartik's agent raised it",
      "Parked: nobody decided in time",
      "Ana approved",
      "The agent's retry used the approval",
    ]);
  });

  it("tells a question from a denial and puts expiry last", () => {
    const asked = timeline(
      gate({
        status: "denied",
        question: "Which tables?",
        votes: [{ userId: "a", name: "Ana", decision: "deny", reason: "Which tables?", at: at(2) }],
      }),
    );
    expect(asked[1]).toMatchObject({ text: 'Ana asked a question: "Which tables?"', tone: "wait" });
    expect(timeline(gate({ status: "expired" })).at(-1)).toEqual({
      at: null,
      text: "Expired without a decision",
      tone: "neutral",
    });
  });
});
