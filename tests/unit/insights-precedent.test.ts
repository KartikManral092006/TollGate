import { describe, expect, it } from "vitest";
import { tallyLine } from "@/features/insights/components/precedent-note";
import { commandShape, findPrecedent, shapeSimilarity } from "@/features/insights/shared/precedent";
import type { HistoryGate } from "@/features/insights/shared/types";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 9)).toISOString();

function past(patch: Partial<HistoryGate>): HistoryGate {
  return {
    id: "h1",
    code: 1,
    repo: "acme/billing",
    preset: "db-migrate",
    env: "staging",
    command: "npx prisma migrate deploy",
    status: "approved",
    denyReason: null,
    createdAt: at(1),
    decidedAt: at(1),
    requesterId: "r",
    votes: [{ userId: "a", name: "Ana", decision: "approve" }],
    ...patch,
  };
}

const target = {
  id: "now",
  repo: "acme/billing",
  preset: "db-migrate",
  command: "DATABASE_URL=postgres://deploy:[REDACTED]@db:5432/billing npx prisma migrate deploy",
  createdAt: at(10),
};

describe("commandShape", () => {
  it("sets aside secrets, values, quotes and numbers", () => {
    expect(commandShape("API_KEY=abc fly deploy -a app-42 --image 'x:1'")).toBe(
      "api_key=‹v› fly deploy -a app-‹n› --image ‹q›",
    );
    expect(commandShape("git push origin 3f9a2b1c")).toBe("git push origin ‹h›");
    expect(commandShape("psql -c [REDACTED]")).toBe("psql -c ‹s›");
  });

  it("treats the same command with different values as the same shape", () => {
    expect(commandShape("DATABASE_URL=postgres://a:[REDACTED]@x npx prisma migrate deploy")).toBe(
      commandShape("DATABASE_URL=postgres://b:[REDACTED]@y npx prisma migrate deploy"),
    );
  });
});

describe("shapeSimilarity", () => {
  it("is 1 for equal shapes and 0 for empty ones", () => {
    expect(shapeSimilarity("a b", "a b")).toBe(1);
    expect(shapeSimilarity("", "a")).toBe(0);
  });

  it("is the share of words in common", () => {
    expect(shapeSimilarity("a b c", "a b d")).toBeCloseTo(0.5);
  });
});

describe("findPrecedent", () => {
  it("returns null without history", () => {
    expect(findPrecedent(target, [])).toBeNull();
  });

  it("finds the same command and counts every decision on it in the repo", () => {
    const history = [
      past({
        id: "h2",
        code: 7,
        command: "DATABASE_URL=postgres://x:[REDACTED]@db:5432/billing npx prisma migrate deploy",
        status: "denied",
        denyReason: "Back up first.",
        createdAt: at(5),
        decidedAt: at(5),
        votes: [{ userId: "b", name: "Raj", decision: "deny" }],
      }),
      past({
        id: "h1",
        code: 3,
        command: "DATABASE_URL=postgres://y:[REDACTED]@db:5432/billing npx prisma migrate deploy",
        createdAt: at(2),
      }),
    ];
    expect(findPrecedent(target, history)).toEqual({
      gateId: "h2",
      code: 7,
      status: "denied",
      by: ["Raj"],
      reason: "Back up first.",
      decidedAt: at(5),
      match: "same",
      repo: "acme/billing",
      sameRepo: true,
      tally: { approved: 1, denied: 1 },
    });
  });

  it("prefers the same command over a newer similar one", () => {
    const history = [
      past({
        id: "similar",
        command: "DATABASE_URL=postgres://x:[REDACTED]@db:5432/billing npx prisma migrate reset",
        createdAt: at(9),
      }),
      past({
        id: "same",
        command: "DATABASE_URL=postgres://x:[REDACTED]@db:5432/billing npx prisma migrate deploy",
        createdAt: at(3),
      }),
    ];
    expect(findPrecedent(target, history)?.gateId).toBe("same");
  });

  it("only borrows a similar decision from the same preset", () => {
    const history = [
      past({
        id: "deploy",
        preset: "prod-deploy",
        command: "DATABASE_URL=postgres://x:[REDACTED]@db:5432/billing npx prisma migrate reset",
      }),
    ];
    expect(findPrecedent(target, history)).toBeNull();
  });

  it("ignores gates created after the target and the target itself", () => {
    const history = [
      past({ id: "later", command: target.command, createdAt: at(11) }),
      past({ id: "now", command: target.command, createdAt: at(1) }),
    ];
    expect(findPrecedent(target, history)).toBeNull();
  });

  it("names every approver and marks another repo", () => {
    const found = findPrecedent(target, [
      past({
        repo: "acme/web",
        command: target.command,
        votes: [
          { userId: "a", name: "Ana", decision: "approve" },
          { userId: "b", name: "Raj", decision: "approve" },
        ],
      }),
    ]);
    expect(found).toMatchObject({ by: ["Ana", "Raj"], sameRepo: false, repo: "acme/web" });
    // Decisions in other repos don't count towards this repo's tally.
    expect(found?.tally).toEqual({ approved: 0, denied: 0 });
  });
});

describe("tallyLine", () => {
  it("stays quiet for a single decision", () => {
    expect(tallyLine({ approved: 1, denied: 0 })).toBeNull();
  });

  it("summarises repeated decisions", () => {
    expect(tallyLine({ approved: 3, denied: 1 })).toBe(
      "This exact command in this repo: approved 3 times, denied once.",
    );
    expect(tallyLine({ approved: 2, denied: 0 })).toBe(
      "This exact command in this repo: approved twice.",
    );
  });
});
