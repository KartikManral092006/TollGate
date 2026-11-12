import { describe, expect, it } from "vitest";
import { evaluate } from "@/features/gates/shared/quorum";
import { durationLabel, freezeView, frozenQuorum, isFrozen } from "@/features/teams/shared/freeze";

const now = new Date("2026-11-12T12:00:00Z");
const team = (until: Date | null) => ({
  freezeKind: "incident",
  freezeReason: "Payments are down",
  freezeUntil: until,
  freezeStartedAt: new Date("2026-11-12T11:00:00Z"),
});

describe("freeze", () => {
  it("is on until its end time", () => {
    expect(isFrozen(team(new Date("2026-11-12T13:00:00Z")), now)).toBe(true);
    expect(isFrozen(team(now), now)).toBe(false);
    expect(isFrozen(team(null), now)).toBe(false);
    expect(freezeView(team(new Date("2026-11-12T13:00:00Z")), "Ana", now)).toEqual({
      kind: "incident",
      reason: "Payments are down",
      until: "2026-11-12T13:00:00.000Z",
      startedAt: "2026-11-12T11:00:00.000Z",
      by: "Ana",
    });
    expect(freezeView(team(now), "Ana", now)).toBeNull();
  });

  it("asks production for two approvals, but never more than can vote, never less than before", () => {
    expect(frozenQuorum({ quorum: 1, env: "prod", voters: 5 })).toBe(2);
    expect(frozenQuorum({ quorum: 3, env: "prod", voters: 5 })).toBe(3);
    // Only one person can vote: two would never come.
    expect(frozenQuorum({ quorum: 1, env: "prod", voters: 1 })).toBe(1);
    expect(frozenQuorum({ quorum: 1, env: "prod", voters: 0 })).toBe(1);
    expect(frozenQuorum({ quorum: 1, env: "staging", voters: 5 })).toBe(1);
  });

  it("lets an owner's single approval decide a frozen production gate", () => {
    const base = { status: "pending" as const, quorum: 2, requesterId: "dev" };
    const ana = [{ userId: "ana", decision: "approve" as const }];
    expect(evaluate({ ...base, votes: ana }).status).toBe("pending");
    expect(evaluate({ ...base, votes: ana, soloApprovers: ["ana"] }).status).toBe("approved");
    // The requester can't be their own solo approver.
    expect(
      evaluate({
        ...base,
        votes: [{ userId: "dev", decision: "approve" }],
        soloApprovers: ["dev"],
      }).status,
    ).toBe("pending");
    // A deny still wins.
    expect(
      evaluate({
        ...base,
        votes: [...ana, { userId: "ben", decision: "deny" }],
        soloApprovers: ["ana"],
      }).status,
    ).toBe("denied");
  });

  it("names durations in plain words", () => {
    expect([60, 240, 1440, 4320].map(durationLabel)).toEqual([
      "1 hour",
      "4 hours",
      "1 day",
      "3 days",
    ]);
  });
});

describe("until when", () => {
  it("shows the day only when it isn't today", async () => {
    const { untilTime, clockTime } = await import("@/features/room/shared/format");
    const now = new Date(2026, 10, 12, 9, 0);
    const later = new Date(2026, 10, 12, 18, 0);
    expect(untilTime(later.toISOString(), now)).toBe(clockTime(later.toISOString()));
    const friday = new Date(2026, 10, 13, 18, 0);
    expect(untilTime(friday.toISOString(), now)).toMatch(/^Fri /);
  });
});
