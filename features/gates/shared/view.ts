// What the room and the audit log render for one gate. Built from a listTeamGates row on the
// server; plain JSON, so it survives the trip to the browser unchanged.

export type GateStatusView = "pending" | "approved" | "denied" | "parked" | "expired";

export type GateVoteView = {
  userId: string;
  name: string;
  decision: "approve" | "deny";
  reason: string | null;
  at: string;
};

export type GateCallView = {
  id: string; // permit id, for /api/calls/:id/*
  callId: string | null; // Nexconn call id, set once the call is live
  startedById: string;
  kind: "huddle" | "ring";
  status: "permitted" | "live" | "ended" | "failed";
  durationSec: number | null;
  participants: number;
};

export type GateView = {
  id: string;
  code: number;
  status: GateStatusView;
  preset: string;
  env: string;
  repo: string;
  mode: "guard" | "delegate";
  branch: string | null;
  command: string;
  context: string;
  // The agent's own description of the command: its claim, not a fact.
  intent: string | null;
  redactions: number;
  quorum: number;
  approvals: number;
  requester: { id: string; name: string };
  votes: GateVoteView[];
  denyReason: string | null;
  decidedAt: string | null;
  parkedAt: string | null;
  grant: { expiresAt: string; usedAt: string | null } | null;
  calls: GateCallView[];
  createdAt: string;
};

type DateLike = Date | string;

const iso = (value: DateLike): string => (typeof value === "string" ? value : value.toISOString());
const isoOrNull = (value: DateLike | null | undefined): string | null =>
  value == null ? null : iso(value);

export type GateRow = {
  id: string;
  code: number;
  status: GateStatusView;
  preset: string;
  env: string;
  branch: string | null;
  command: string;
  context: string;
  intent?: string | null;
  redactions: number;
  quorum: number;
  denyReason: string | null;
  decidedAt: DateLike | null;
  parkedAt: DateLike | null;
  createdAt: DateLike;
  requester: { id: string; name: string };
  repo: { name: string; mode: "guard" | "delegate" };
  votes: {
    userId: string;
    decision: "approve" | "deny";
    reason: string | null;
    createdAt: DateLike;
    user: { name: string };
  }[];
  grant: { expiresAt: DateLike; usedAt: DateLike | null } | null;
  calls: {
    id: string;
    callId: string | null;
    startedById: string;
    kind: "huddle" | "ring";
    status: "permitted" | "live" | "ended" | "failed";
    durationSec: number | null;
    participants: string[];
  }[];
};

export function displayName(name: string, id: string): string {
  const trimmed = name.trim();
  return trimmed || `Member ${id.slice(-4).toUpperCase()}`;
}

export function toGateView(row: GateRow): GateView {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    preset: row.preset,
    env: row.env,
    repo: row.repo.name,
    mode: row.repo.mode,
    branch: row.branch,
    command: row.command,
    context: row.context,
    intent: row.intent ?? null,
    redactions: row.redactions,
    quorum: row.quorum,
    approvals: row.votes.filter((vote) => vote.decision === "approve").length,
    requester: { id: row.requester.id, name: displayName(row.requester.name, row.requester.id) },
    votes: row.votes.map((vote) => ({
      userId: vote.userId,
      name: displayName(vote.user.name, vote.userId),
      decision: vote.decision,
      reason: vote.reason,
      at: iso(vote.createdAt),
    })),
    denyReason: row.denyReason,
    decidedAt: isoOrNull(row.decidedAt),
    parkedAt: isoOrNull(row.parkedAt),
    grant: row.grant
      ? { expiresAt: iso(row.grant.expiresAt), usedAt: isoOrNull(row.grant.usedAt) }
      : null,
    calls: row.calls
      .filter((call) => call.status !== "failed")
      .map((call) => ({
        id: call.id,
        callId: call.callId,
        startedById: call.startedById,
        kind: call.kind,
        status: call.status,
        durationSec: call.durationSec,
        participants: call.participants.length,
      })),
    createdAt: iso(row.createdAt),
  };
}

// Newest state wins when the same gate arrives from two sources (initial load, poll, live).
export function mergeGates(current: GateView[], incoming: GateView[]): GateView[] {
  const byId = new Map(current.map((gate) => [gate.id, gate]));
  for (const gate of incoming) byId.set(gate.id, gate);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.code - b.code,
  );
}

export function isOpenStatus(status: GateStatusView): boolean {
  return status === "pending" || status === "parked";
}
