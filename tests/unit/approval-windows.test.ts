import { describe, expect, it } from "vitest";
import { voteSchema } from "@/features/gates/shared/schemas";
import { canOpenWindow, roleCanOpenWindow, windowLabel } from "@/features/gates/shared/windows";

describe("canOpenWindow", () => {
  it("allows one-approval gates outside production", () => {
    expect(canOpenWindow({ preset: "db-migrate", env: "staging", quorum: 1 })).toBe(true);
    expect(canOpenWindow({ preset: "ci-config", env: "other", quorum: 1 })).toBe(true);
  });

  it("refuses production, two approvals, and kinds whose mistakes can't be undone", () => {
    expect(canOpenWindow({ preset: "db-migrate", env: "prod", quorum: 1 })).toBe(false);
    expect(canOpenWindow({ preset: "db-migrate", env: "staging", quorum: 2 })).toBe(false);
    for (const preset of ["publish", "infra", "destructive-fs", "guard-config", "mcp-risky"]) {
      expect(canOpenWindow({ preset, env: "other", quorum: 1 })).toBe(false);
    }
  });

  it("is for owners and approvers, not clients", () => {
    expect(roleCanOpenWindow("owner")).toBe(true);
    expect(roleCanOpenWindow("approver")).toBe(true);
    expect(roleCanOpenWindow("guest")).toBe(false);
  });
});

describe("voteSchema windowMinutes", () => {
  it("accepts the offered lengths on an approval only", () => {
    expect(voteSchema.safeParse({ decision: "approve", windowMinutes: 120 }).success).toBe(true);
    expect(voteSchema.safeParse({ decision: "approve", windowMinutes: 45 }).success).toBe(false);
    expect(
      voteSchema.safeParse({ decision: "deny", reason: "no", windowMinutes: 60 }).success,
    ).toBe(false);
  });

  it("names lengths in plain words", () => {
    expect([30, 60, 120, 240].map(windowLabel)).toEqual([
      "30 minutes",
      "1 hour",
      "2 hours",
      "4 hours",
    ]);
  });
});
