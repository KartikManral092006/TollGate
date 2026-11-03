import { describe, expect, it } from "vitest";
import { commandHash } from "@/features/gates/shared/hook-api";
import { evaluate, needsGrant, voteRejection } from "@/features/gates/shared/quorum";

const base = { status: "pending" as const, quorum: 2, requesterId: "req" };

describe("evaluate", () => {
  it("stays pending below quorum", () => {
    expect(evaluate({ ...base, votes: [{ userId: "a", decision: "approve" }] })).toEqual({
      status: "pending",
      approvals: 1,
    });
  });

  it("approves at quorum", () => {
    const votes = [
      { userId: "a", decision: "approve" as const },
      { userId: "b", decision: "approve" as const },
    ];
    expect(evaluate({ ...base, votes })).toEqual({ status: "approved", approvals: 2 });
  });

  it("lets one deny veto, even after approvals", () => {
    const votes = [
      { userId: "a", decision: "approve" as const },
      { userId: "b", decision: "deny" as const },
    ];
    expect(evaluate({ ...base, votes })).toEqual({
      status: "denied",
      approvals: 1,
      deniedBy: "b",
    });
  });

  it("never counts the requester", () => {
    const votes = [
      { userId: "req", decision: "approve" as const },
      { userId: "a", decision: "approve" as const },
    ];
    expect(evaluate({ ...base, votes }).status).toBe("pending");
    expect(evaluate({ ...base, votes: [{ userId: "req", decision: "deny" }] }).status).toBe(
      "pending",
    );
  });

  it("keeps a parked gate parked until it is decided", () => {
    expect(evaluate({ ...base, status: "parked", votes: [] }).status).toBe("parked");
    const votes = [
      { userId: "a", decision: "approve" as const },
      { userId: "b", decision: "approve" as const },
    ];
    expect(evaluate({ ...base, status: "parked", votes }).status).toBe("approved");
  });
});

describe("voteRejection", () => {
  const ok = { status: "pending" as const, requesterId: "req", voterId: "a", voterCanVote: true };

  it("accepts an eligible voter on an open gate", () => {
    expect(voteRejection(ok)).toBeNull();
    expect(voteRejection({ ...ok, status: "parked" })).toBeNull();
  });

  it.each(["approved", "denied", "expired"] as const)("rejects votes on a %s gate", (status) => {
    expect(voteRejection({ ...ok, status })).toBe("closed");
  });

  it("rejects the requester and roles that can't vote", () => {
    expect(voteRejection({ ...ok, voterId: "req" })).toBe("own_gate");
    expect(voteRejection({ ...ok, voterCanVote: false })).toBe("not_allowed");
  });
});

describe("needsGrant", () => {
  it("issues a grant only when a parked gate gets approved", () => {
    expect(needsGrant("parked", "approved")).toBe(true);
    expect(needsGrant("pending", "approved")).toBe(false);
    expect(needsGrant("parked", "denied")).toBe(false);
  });
});

describe("commandHash", () => {
  const input = { repo: "acme/billing", cwd: "/w/acme", command: "vercel --prod" };

  it("is stable and changes with any part", () => {
    expect(commandHash(input)).toBe(commandHash({ ...input }));
    expect(commandHash(input)).toMatch(/^[a-f0-9]{64}$/);
    expect(commandHash({ ...input, cwd: "/w/other" })).not.toBe(commandHash(input));
    expect(commandHash({ ...input, repo: "acme/web" })).not.toBe(commandHash(input));
    expect(commandHash({ ...input, command: "vercel --prod --force" })).not.toBe(
      commandHash(input),
    );
  });

  it("can't be fooled by moving characters between fields", () => {
    expect(commandHash({ repo: "a", cwd: "b c", command: "d" })).not.toBe(
      commandHash({ repo: "a", cwd: "b", command: "c d" }),
    );
  });
});
