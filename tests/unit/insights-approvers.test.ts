import { describe, expect, it } from "vitest";
import { approverLine } from "@/features/insights/components/suggested-approvers";
import { suggestApprovers, type ApproverCandidate } from "@/features/insights/shared/approvers";
import type { HistoryGate } from "@/features/insights/shared/types";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 9)).toISOString();

let next = 0;
function past(voters: string[], patch: Partial<HistoryGate> = {}): HistoryGate {
  next += 1;
  return {
    id: `h${next}`,
    code: next,
    repo: "acme/billing",
    preset: "db-migrate",
    env: "staging",
    command: "npx prisma migrate deploy",
    status: "approved",
    denyReason: null,
    createdAt: at(1),
    decidedAt: at(1),
    requesterId: "kartik",
    votes: voters.map((userId) => ({ userId, name: userId, decision: "approve" as const })),
    ...patch,
  };
}

const members: ApproverCandidate[] = [
  { id: "kartik", name: "Kartik", canVote: true },
  { id: "ana", name: "Ana Weber", canVote: true },
  { id: "raj", name: "Raj", canVote: true },
  { id: "bot", name: "Requester role", canVote: false },
];

const gate = {
  id: "now",
  repo: "acme/billing",
  preset: "db-migrate",
  createdAt: at(10),
  requester: { id: "kartik" },
  votes: [] as { userId: string }[],
};

describe("suggestApprovers", () => {
  it("ranks who decided this kind of gate in this repo", () => {
    const history = [past(["ana"]), past(["ana", "raj"]), past(["ana"]), past(["raj"])];
    expect(suggestApprovers(gate, history, members)).toEqual([
      { userId: "ana", name: "Ana Weber", decided: 3, of: 4, scope: "preset" },
      { userId: "raj", name: "Raj", decided: 2, of: 4, scope: "preset" },
    ]);
  });

  it("falls back to the whole repo when this preset is thin", () => {
    const history = [
      past(["ana"], { preset: "prod-deploy" }),
      past(["ana"], { preset: "publish" }),
      past(["raj"]),
    ];
    expect(suggestApprovers(gate, history, members)).toEqual([
      { userId: "ana", name: "Ana Weber", decided: 2, of: 3, scope: "repo" },
    ]);
  });

  it("skips the requester, non-voters, people who already voted and other repos", () => {
    const history = [
      past(["kartik", "bot"]),
      past(["kartik", "bot"]),
      past(["ana"], { repo: "acme/web" }),
      past(["ana"], { repo: "acme/web" }),
      past(["raj"]),
      past(["raj"]),
    ];
    expect(suggestApprovers({ ...gate, votes: [{ userId: "raj" }] }, history, members)).toEqual([]);
  });

  it("needs at least two decisions and ignores later gates", () => {
    expect(suggestApprovers(gate, [past(["ana"])], members)).toEqual([]);
    expect(
      suggestApprovers(gate, [past(["ana"], { createdAt: at(11) }), past(["ana"])], members),
    ).toEqual([]);
  });
});

describe("approverLine", () => {
  const context = { viewerId: "kartik", preset: "db-migrate", repo: "acme/billing" };

  it("names one person", () => {
    expect(
      approverLine(
        [{ userId: "ana", name: "Ana Weber", decided: 7, of: 9, scope: "preset" }],
        context,
      ),
    ).toBe("Ana Weber usually decides db-migrate gates in acme/billing: 7 of the last 9.");
  });

  it("speaks to the viewer and names two people", () => {
    expect(
      approverLine(
        [
          { userId: "kartik", name: "Kartik", decided: 5, of: 8, scope: "repo" },
          { userId: "raj", name: "Raj", decided: 3, of: 8, scope: "repo" },
        ],
        context,
      ),
    ).toBe("You and Raj usually decide gates in acme/billing: 5 and 3 of the last 8.");
  });

  it("is empty without suggestions", () => {
    expect(approverLine([], context)).toBeNull();
  });
});
