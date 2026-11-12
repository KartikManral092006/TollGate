import { describe, expect, it } from "vitest";
import {
  applyRule,
  canHaveRule,
  failedShare,
  suggestPolicies,
  suggestionKey,
  type PolicyHistoryGate,
} from "@/features/insights/shared/policy";
import { suggestionEvidence, suggestionTitle } from "@/features/settings/components/rules-card";

const at = (sec: number) => new Date(Date.UTC(2026, 10, 3, 9, 0, sec)).toISOString();

function decided(n: number, patch: Partial<PolicyHistoryGate> = {}): PolicyHistoryGate[] {
  return Array.from({ length: n }, (_, i) => ({
    repoId: "r1",
    repo: "acme/billing",
    preset: "staging-deploy",
    env: "staging",
    status: "approved" as const,
    quorum: 1,
    createdAt: at(0),
    decidedAt: at(i < n / 2 ? 2 : 20),
    approvalMs: [i < n / 2 ? 2000 : 20_000],
    ...patch,
  }));
}

describe("suggestPolicies", () => {
  it("suggests auto-approval after 10 approvals with no denials", () => {
    expect(suggestPolicies(decided(10), [], {})).toEqual([
      {
        key: "staging-deploy:staging:auto_approve",
        repoId: "r1",
        repo: "acme/billing",
        preset: "staging-deploy",
        env: "staging",
        action: "auto_approve",
        decided: 10,
        medianSec: 11,
        fastShare: 0.5,
      },
    ]);
  });

  it("needs ten decisions and no denials", () => {
    expect(suggestPolicies(decided(9), [], {})).toEqual([]);
    expect(suggestPolicies([...decided(12), ...decided(1, { status: "denied" })], [], {})).toEqual(
      [],
    );
  });

  it("offers nothing when too many approved runs then failed", () => {
    const runs = (n: number, outcome: PolicyHistoryGate["outcome"]) => decided(n, { outcome });
    // 1 of 12 reported runs failed: under a tenth, still offered.
    expect(suggestPolicies([...runs(11, "succeeded"), ...runs(1, "failed")], [], {})).toHaveLength(
      1,
    );
    // 2 of 10 failed: the approvals weren't catching problems.
    expect(suggestPolicies([...runs(8, "succeeded"), ...runs(2, "failed")], [], {})).toEqual([]);
    // Unreported runs (older CLIs) and interruptions don't count either way.
    expect(
      suggestPolicies([...runs(9, null), ...runs(1, "failed"), ...runs(5, "interrupted")], [], {}),
    ).toEqual([]);
    expect(failedShare(runs(10, null))).toBe(0);
  });

  it("offers one approval before auto-approval when two were needed", () => {
    const history = decided(10, { quorum: 2 });
    expect(suggestPolicies(history, [], {})[0]?.action).toBe("one_approval");
    const rule = { repoId: "r1", preset: "staging-deploy", env: "staging" };
    expect(suggestPolicies(history, [{ ...rule, action: "one_approval" }], {})[0]?.action).toBe(
      "auto_approve",
    );
    expect(suggestPolicies(history, [{ ...rule, action: "auto_approve" }], {})).toEqual([]);
  });

  it("never suggests rules for production or irreversible presets", () => {
    expect(suggestPolicies(decided(20, { env: "prod" }), [], {})).toEqual([]);
    for (const preset of ["publish", "infra", "destructive-fs"]) {
      expect(suggestPolicies(decided(20, { preset, env: "other" }), [], {})).toEqual([]);
    }
    expect(canHaveRule("db-migrate", "staging")).toBe(true);
    expect(canHaveRule("db-migrate", "prod")).toBe(false);
  });

  it("keeps groups apart and respects dismissals", () => {
    const history = [...decided(10), ...decided(10, { repoId: "r2", repo: "acme/web" })];
    expect(suggestPolicies(history, [], {}).map((s) => s.repoId)).toEqual(["r1", "r2"]);
    const dismissed = { r1: [suggestionKey("staging-deploy", "staging", "auto_approve")] };
    expect(suggestPolicies(history, [], dismissed).map((s) => s.repoId)).toEqual(["r2"]);
  });
});

describe("applyRule", () => {
  const gate = { env: "staging", commandLooksProd: false, quorum: 2 };

  it("changes nothing without a rule", () => {
    expect(applyRule(null, gate)).toEqual({ quorum: 2, autoApprove: false });
  });

  it("lowers the quorum or approves on arrival", () => {
    expect(applyRule({ action: "one_approval" }, gate)).toEqual({ quorum: 1, autoApprove: false });
    expect(applyRule({ action: "auto_approve" }, gate)).toEqual({ quorum: 2, autoApprove: true });
  });

  it("never touches production, by env or by the command itself", () => {
    expect(applyRule({ action: "auto_approve" }, { ...gate, env: "prod" })).toEqual({
      quorum: 2,
      autoApprove: false,
    });
    expect(applyRule({ action: "auto_approve" }, { ...gate, commandLooksProd: true })).toEqual({
      quorum: 2,
      autoApprove: false,
    });
  });
});

describe("suggestion copy", () => {
  const base = { preset: "staging-deploy", env: "staging", repo: "acme/billing" };

  it("names the change", () => {
    expect(suggestionTitle({ ...base, action: "one_approval" })).toBe(
      "Ask for one approval, not two, on staging-deploy (staging) in acme/billing",
    );
    expect(suggestionTitle({ ...base, action: "auto_approve" })).toBe(
      "Approve staging-deploy (staging) in acme/billing automatically",
    );
  });

  it("gives the evidence, and the rubber stamps for auto-approval", () => {
    expect(
      suggestionEvidence({ action: "auto_approve", decided: 14, medianSec: 8, fastShare: 0.64 }),
    ).toBe(
      "Your team approved all 14 in the last 30 days and denied none. Median wait: 8 s. 64% were approved within 3 seconds, too fast to have been read.",
    );
    expect(
      suggestionEvidence({ action: "one_approval", decided: 10, medianSec: 300, fastShare: 0.5 }),
    ).toBe("Your team approved all 10 in the last 30 days and denied none. Median wait: 5 min.");
  });
});
