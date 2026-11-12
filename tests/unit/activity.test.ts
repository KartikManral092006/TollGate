import { describe, expect, it } from "vitest";
import {
  activityEvents,
  unreadCount,
  type ActivityGate,
} from "@/features/activity/shared/activity";

const at = (min: number) => new Date(Date.UTC(2026, 10, 4, 9, min)).toISOString();

function gate(patch: Partial<ActivityGate>): ActivityGate {
  return {
    id: "g1",
    code: 17,
    teamId: "t",
    teamName: "Billing",
    requester: { id: "kartik", name: "Kartik" },
    command: "pnpm db:deploy",
    status: "pending",
    question: null,
    createdAt: at(0),
    parkedAt: null,
    decidedAt: null,
    autoApproved: false,
    votes: [],
    ...patch,
  };
}

describe("activityEvents", () => {
  it("tells you about others' gates and decisions, newest first, never your own actions", () => {
    const events = activityEvents(
      [
        gate({
          votes: [
            { userId: "ana", name: "Ana", decision: "deny", reason: "Back up first", at: at(5) },
            { userId: "me", name: "Me", decision: "approve", reason: null, at: at(3) },
          ],
          parkedAt: at(4),
        }),
      ],
      "me",
    );
    expect(events.map((e) => e.text)).toEqual([
      'Ana denied TG-17: "Back up first"',
      "TG-17 parked: nobody decided in time",
      "Kartik's agent raised TG-17",
    ]);
  });

  it("speaks to the requester about their agent's gate, questions and rules included", () => {
    const events = activityEvents(
      [
        gate({
          requester: { id: "me", name: "Me" },
          question: "Which tables?",
          votes: [
            { userId: "ana", name: "Ana", decision: "deny", reason: "Which tables?", at: at(2) },
          ],
        }),
        gate({
          id: "g2",
          code: 18,
          requester: { id: "me", name: "Me" },
          autoApproved: true,
          decidedAt: at(9),
        }),
      ],
      "me",
    );
    expect(events.map((e) => [e.kind, e.text, e.mine])).toEqual([
      ["auto", "TG-18 approved by a team rule", true],
      ["asked", `Ana asked about your agent's TG-17: "Which tables?"`, true],
    ]);
  });
});

describe("unreadCount", () => {
  it("counts what happened after you last looked", () => {
    const events = activityEvents([gate({ parkedAt: at(10) })], "me");
    expect(unreadCount(events, Date.parse(at(5)))).toBe(1);
    expect(unreadCount(events, 0)).toBe(2);
  });
});

describe("activity command preview", () => {
  it("shows the command's first line, shortened, and whether the gate still waits", () => {
    const long = `npx prisma migrate deploy ${"x".repeat(200)}\nsecond line`;
    const [open] = activityEvents([gate({ command: long, status: "parked" })], "me");
    expect(open?.command.endsWith("…")).toBe(true);
    expect(open?.command.length).toBe(120);
    expect(open?.command).not.toContain("second line");
    expect(open?.waiting).toBe(true);
    const [done] = activityEvents([gate({ status: "approved" })], "me");
    expect(done?.command).toBe("pnpm db:deploy");
    expect(done?.waiting).toBe(false);
  });
});
