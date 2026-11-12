// What the room and the audit log render for one gate. Built from a listTeamGates row on the
// server; plain JSON, so it survives the trip to the browser unchanged.

import { GATE_TOOLS, type GateTool } from "@/features/gates/shared/presets";
import { GATE_OUTCOMES, type GateOutcome } from "@/features/gates/shared/outcomes";
import type { GateInsights } from "@/features/insights/shared/types";

// Rows from before file and MCP gates have no tool column value but "bash".
export function toolOf(value: string | undefined): GateTool {
  return (GATE_TOOLS as readonly string[]).includes(value ?? "") ? (value as GateTool) : "bash";
}

export type GateStatusView = "pending" | "approved" | "denied" | "parked" | "expired" | "bypassed";

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
  // What was stopped: a command, a file edit or an MCP tool call.
  tool: GateTool;
  env: string;
  repo: string;
  mode: "guard" | "delegate";
  branch: string | null;
  command: string;
  context: string;
  // The agent's own description of the command: its claim, not a fact.
  intent: string | null;
  // What a wrapper or package script really runs, one "from → runs" line each.
  via: string | null;
  // What it will do, from read-only checks on the developer's machine (CLI 0.3+); the first
  // line is the headline.
  preview?: string | null;
  // The developer's last instruction to the agent and its calls since (opt-in, CLI 0.3+).
  task?: string | null;
  steps?: string[];
  redactions: number;
  quorum: number;
  approvals: number;
  requester: { id: string; name: string };
  // The Claude Code session that raised it, for grouping a run's gates in the room.
  session?: string | null;
  // The bot's TG:Gate card in the team's group.
  messageId?: string | null;
  // Teammates who have looked at the card, first look first.
  seenBy?: { userId: string; name: string }[];
  votes: GateVoteView[];
  denyReason: string | null;
  // An approver asked instead of deciding; the gate closed and the agent got the question.
  question: string | null;
  // This gate is the agent's retry after a question: its intent is the answer.
  followUp: { code: number; question: string; askedBy: string } | null;
  // The asked gate's answer arrived as this gate.
  answeredIn: number | null;
  // A team rule changed this gate: one approval instead of more, or approved on arrival.
  rule: {
    action: "one_approval" | "auto_approve";
    preset: string;
    env: string;
    by: string | null;
  } | null;
  // Approved on arrival by someone's approval window, open until `until`.
  window: { by: string; until: string } | null;
  // The approval window opened when this gate was approved, if any.
  opened: {
    id: string;
    by: string;
    until: string;
    endedAt: string | null;
    endedBy: string | null;
    // Gates it has approved so far.
    used: number;
  } | null;
  decidedAt: string | null;
  // When the waiting agent will give up and park this gate, if it's still pending.
  parksAt: string | null;
  parkedAt: string | null;
  grant: { expiresAt: string; usedAt: string | null } | null;
  calls: GateCallView[];
  createdAt: string;
  // Decision aids from the team's history; only on open gates (features/insights).
  insights?: GateInsights | null;
  // What happened when the approved call ran (CLI 0.3+); null until the hook reports it.
  ran?: GateRunView | null;
  // A bypassed gate's after-the-fact review, once someone has looked at it.
  review?: { by: string; at: string; note: string | null } | null;
};

export type GateRunView = {
  outcome: GateOutcome;
  at: string;
  exitCode: number | null;
  durationMs: number | null;
  // The output's tail, redacted.
  output: string | null;
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
  tool?: string;
  env: string;
  branch: string | null;
  command: string;
  context: string;
  intent?: string | null;
  via?: string | null;
  task?: string | null;
  steps?: string | null;
  preview?: string | null;
  redactions: number;
  quorum: number;
  denyReason: string | null;
  question?: string | null;
  followUpOf?: {
    code: number;
    question: string | null;
    votes: { userId: string; user: { name: string } }[];
  } | null;
  followUps?: { code: number }[];
  policyRule?: {
    action: "one_approval" | "auto_approve";
    preset: string;
    env: string;
    createdBy: { name: string } | null;
  } | null;
  window?: { expiresAt: DateLike; createdBy: { name: string } } | null;
  windowsOpened?: {
    id: string;
    expiresAt: DateLike;
    endedAt: DateLike | null;
    createdBy: { name: string };
    endedBy: { name: string } | null;
    _count: { approved: number };
  }[];
  decidedAt: DateLike | null;
  sessionId?: string | null;
  messageId?: string | null;
  seen?: { userId: string; seenAt: DateLike; user: { name: string } }[];
  parksAt?: DateLike | null;
  parkedAt: DateLike | null;
  reviewedAt?: DateLike | null;
  reviewNote?: string | null;
  reviewedBy?: { name: string } | null;
  outcome?: string | null;
  outcomeAt?: DateLike | null;
  exitCode?: number | null;
  durationMs?: number | null;
  output?: string | null;
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

function followUpView(asked: GateRow["followUpOf"]): GateView["followUp"] {
  if (!asked?.question) return null;
  const asker = asked.votes[0];
  return {
    code: asked.code,
    question: asked.question,
    askedBy: asker ? displayName(asker.user.name, asker.userId) : "A teammate",
  };
}

function runView(row: GateRow): GateRunView | null {
  const outcome = GATE_OUTCOMES.find((value) => value === row.outcome);
  if (!outcome || !row.outcomeAt) return null;
  return {
    outcome,
    at: iso(row.outcomeAt),
    exitCode: row.exitCode ?? null,
    durationMs: row.durationMs ?? null,
    output: row.output ?? null,
  };
}

function openedView(window: NonNullable<GateRow["windowsOpened"]>[number] | undefined) {
  if (!window) return null;
  return {
    id: window.id,
    by: window.createdBy.name.trim() || "A teammate",
    until: iso(window.expiresAt),
    endedAt: isoOrNull(window.endedAt),
    endedBy: window.endedBy?.name.trim() || null,
    used: window._count.approved,
  };
}

export function toGateView(row: GateRow): GateView {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    preset: row.preset,
    tool: toolOf(row.tool),
    env: row.env,
    repo: row.repo.name,
    mode: row.repo.mode,
    branch: row.branch,
    command: row.command,
    context: row.context,
    intent: row.intent ?? null,
    via: row.via ?? null,
    preview: row.preview ?? null,
    task: row.task ?? null,
    steps: row.steps ? row.steps.split("\n").filter(Boolean) : [],
    redactions: row.redactions,
    quorum: row.quorum,
    approvals: row.votes.filter((vote) => vote.decision === "approve").length,
    requester: { id: row.requester.id, name: displayName(row.requester.name, row.requester.id) },
    session: row.sessionId ?? null,
    messageId: row.messageId ?? null,
    seenBy: (row.seen ?? []).map((look) => ({
      userId: look.userId,
      name: displayName(look.user.name, look.userId),
    })),
    votes: row.votes.map((vote) => ({
      userId: vote.userId,
      name: displayName(vote.user.name, vote.userId),
      decision: vote.decision,
      reason: vote.reason,
      at: iso(vote.createdAt),
    })),
    denyReason: row.denyReason,
    question: row.question ?? null,
    followUp: followUpView(row.followUpOf),
    answeredIn: row.followUps?.[0]?.code ?? null,
    rule: row.policyRule
      ? {
          action: row.policyRule.action,
          preset: row.policyRule.preset,
          env: row.policyRule.env,
          by: row.policyRule.createdBy?.name.trim() || null,
        }
      : null,
    window: row.window
      ? { by: row.window.createdBy.name.trim() || "A teammate", until: iso(row.window.expiresAt) }
      : null,
    opened: openedView(row.windowsOpened?.[0]),
    decidedAt: isoOrNull(row.decidedAt),
    parksAt: isoOrNull(row.parksAt),
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
    ran: runView(row),
    review: row.reviewedAt
      ? {
          by: row.reviewedBy?.name.trim() || "A teammate",
          at: iso(row.reviewedAt),
          note: row.reviewNote ?? null,
        }
      : null,
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

// What a card shows: an asked gate is closed (denied for the hook) but reads as a question.
export type GateDisplayStatus = GateStatusView | "asked";

export function displayStatus(gate: Pick<GateView, "status" | "question">): GateDisplayStatus {
  return gate.status === "denied" && gate.question ? "asked" : gate.status;
}

export function isOpenStatus(status: GateStatusView): boolean {
  return status === "pending" || status === "parked";
}

// A bypass nobody on the team has looked at yet.
export function needsReview(gate: Pick<GateView, "status" | "review">): boolean {
  return gate.status === "bypassed" && !gate.review;
}
