import { describe, expect, it } from "vitest";
import { riskSignals, type SignalInput } from "@/features/insights/shared/signals";
import type { HistoryGate } from "@/features/insights/shared/types";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 3, 9, minute)).toISOString();

function gate(patch: Partial<SignalInput>): SignalInput {
  return {
    id: "now",
    repo: "acme/billing",
    preset: "db-migrate",
    env: "staging",
    command: "npx prisma migrate deploy",
    context: "",
    intent: null,
    branch: "main",
    createdAt: at(50),
    requester: { id: "r" },
    ...patch,
  };
}

function past(patch: Partial<HistoryGate>): HistoryGate {
  return {
    id: "h",
    code: 1,
    repo: "acme/billing",
    preset: "db-migrate",
    env: "staging",
    command: "npx prisma migrate deploy",
    status: "approved",
    denyReason: null,
    createdAt: at(10),
    decidedAt: at(11),
    requesterId: "r",
    votes: [],
    ...patch,
  };
}

const ids = (input: SignalInput, history: HistoryGate[] = []) =>
  riskSignals(input, history).map((signal) => signal.id);

describe("riskSignals", () => {
  it("is quiet for a plain migration with no history", () => {
    expect(riskSignals(gate({}), [])).toEqual([]);
  });

  it("reads data loss from migration SQL", () => {
    const signals = riskSignals(
      gate({ context: 'ALTER TABLE "invoices" DROP COLUMN "legacy_total";\nTRUNCATE audit;' }),
      [],
    );
    expect(signals).toEqual([
      { id: "drop-column", level: "high", text: "Drops a column and every value in it" },
      { id: "truncate", level: "high", text: "Empties a table" },
    ]);
  });

  it("ignores SQL words in a non-migration's context (a commit message)", () => {
    expect(ids(gate({ preset: "prod-deploy", context: "Drop column legacy_total" }))).toEqual([]);
  });

  it("tells DELETE without WHERE from DELETE with one", () => {
    expect(ids(gate({ context: "DELETE FROM sessions;" }))).toEqual(["delete-all"]);
    expect(ids(gate({ context: "DELETE FROM sessions WHERE expired;" }))).toEqual([]);
  });

  it("flags destructive commands and skipped confirmations", () => {
    expect(ids(gate({ preset: "infra", command: "terraform destroy -auto-approve" }))).toEqual([
      "destroy-stack",
      "skip-confirm",
    ]);
    expect(ids(gate({ command: "npx prisma db push --accept-data-loss" }))).toEqual([
      "accept-data-loss",
    ]);
  });

  it("flags an agent that says staging while targeting production", () => {
    const signals = riskSignals(
      gate({ env: "prod", intent: "Deploy the fix to Staging for QA", command: "vercel --prod" }),
      [],
    );
    expect(signals[0]).toEqual({
      id: "intent-env",
      level: "high",
      text: 'The agent says "staging", but this targets production',
    });
    expect(ids(gate({ env: "prod", intent: "Promote staging build to production" }))).toEqual([]);
  });

  it("flags a dry run that isn't one", () => {
    expect(ids(gate({ intent: "Dry run the migration" }))).toEqual(["intent-dry-run"]);
    expect(
      ids(gate({ preset: "publish", intent: "Dry-run publish", command: "npm publish --dry-run" })),
    ).toEqual([]);
  });

  it("flags production from a feature branch", () => {
    expect(ids(gate({ env: "prod", branch: "feat/minor-units" }))).toEqual(["prod-branch"]);
    expect(ids(gate({ env: "prod", branch: "release/2026-11" }))).toEqual([]);
    expect(ids(gate({ env: "staging", branch: "feat/x" }))).toEqual([]);
  });

  it("flags a retry of a command the team denied within the hour", () => {
    const denied = past({ id: "d1", status: "denied", createdAt: at(20) });
    expect(riskSignals(gate({}), [denied])[0]?.text).toBe(
      "Same command was denied in the last hour",
    );
    expect(riskSignals(gate({}), [denied, past({ id: "d2", status: "denied" })])[0]?.text).toBe(
      "Same command was denied 2 times in the last hour",
    );
    // Someone else's denial, or one older than an hour, doesn't count.
    expect(ids(gate({}), [past({ status: "denied", requesterId: "x" })])).toEqual([]);
    expect(ids(gate({ createdAt: at(50 + 60 * 3) }), [denied])).toEqual([]);
  });

  it("flags a first-of-its-kind command once the repo has history", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      past({ id: `h${i}`, command: `fly deploy -a billing-staging` }),
    );
    expect(ids(gate({}), history)).toEqual(["first-time"]);
    expect(ids(gate({}), history.slice(0, 4))).toEqual([]);
    expect(ids(gate({}), [...history, past({ id: "same" })])).toEqual([]);
  });

  it("puts high risks first and keeps at most three", () => {
    const signals = riskSignals(
      gate({
        env: "prod",
        branch: "feat/x",
        command: "npx prisma migrate reset --force",
        context: "DROP TABLE users; TRUNCATE logs;",
        intent: "Reset the dev database",
      }),
      [],
    );
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.level === "high")).toBe(true);
  });
});
