// The gate state machine. Pure, so every transition is unit-tested; the server applies it
// inside one transaction that holds the gate's row lock.
//
//   pending ──approve×quorum──▶ approved
//   pending ──deny────────────▶ denied
//   pending ──park (timeout)──▶ parked ──approve×quorum──▶ approved (+ single-use grant)
//                                      ──deny───────────▶ denied
//                                      ──24 h───────────▶ expired

export type GateStatus = "pending" | "approved" | "denied" | "parked" | "expired" | "bypassed";
export type Decision = "approve" | "deny";
export type CastVote = { userId: string; decision: Decision };

export type Evaluation =
  | { status: "pending" | "parked"; approvals: number }
  | { status: "approved"; approvals: number }
  | { status: "denied"; approvals: number; deniedBy: string };

export function isOpen(status: GateStatus): boolean {
  return status === "pending" || status === "parked";
}

// One deny is a veto: the point is that anyone who knows why it's dangerous can stop it.
export function evaluate(input: {
  status: GateStatus;
  quorum: number;
  requesterId: string;
  votes: CastVote[];
  // One approval from any of these is enough (an owner, on a production gate raised during a
  // freeze: features/teams/shared/freeze.ts).
  soloApprovers?: readonly string[];
}): Evaluation {
  const votes = input.votes.filter((vote) => vote.userId !== input.requesterId);
  const approvals = votes.filter((vote) => vote.decision === "approve").length;
  const denial = votes.find((vote) => vote.decision === "deny");
  if (denial) return { status: "denied", approvals, deniedBy: denial.userId };
  if (approvals >= input.quorum) return { status: "approved", approvals };
  const solo = input.soloApprovers ?? [];
  if (votes.some((vote) => vote.decision === "approve" && solo.includes(vote.userId))) {
    return { status: "approved", approvals };
  }
  return { status: input.status === "parked" ? "parked" : "pending", approvals };
}

export type VoteRejection = "closed" | "own_gate" | "not_allowed";

export function voteRejection(input: {
  status: GateStatus;
  requesterId: string;
  voterId: string;
  voterCanVote: boolean;
}): VoteRejection | null {
  if (!isOpen(input.status)) return "closed";
  if (input.voterId === input.requesterId) return "own_gate";
  if (!input.voterCanVote) return "not_allowed";
  return null;
}

export const GRANT_TTL_MS = 24 * 60 * 60 * 1000;
export const PARKED_TTL_MS = 24 * 60 * 60 * 1000;

// A grant exists only for gates approved after they were parked: the hook stopped waiting,
// so the agent's retry needs something to redeem.
export function needsGrant(previous: GateStatus, next: Evaluation["status"]): boolean {
  return previous === "parked" && next === "approved";
}
