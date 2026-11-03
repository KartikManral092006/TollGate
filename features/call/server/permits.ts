import type { CallSession, PrismaClient } from "@/lib/generated/prisma/client";
import {
  clampDuration,
  DEFAULT_MAX_CALL_SEC,
  END_GRACE_SEC,
  PERMIT_STALE_MS,
  startOfUtcDay,
  withinBudget,
} from "@/features/call/shared/budget";
import { canVote, type TeamRoleValue } from "@/features/teams/shared/schemas";

export class CallRejectedError extends Error {
  override readonly name = "CallRejectedError";

  constructor(
    readonly reason:
      | "calls_disabled"
      | "not_found"
      | "closed"
      | "budget"
      | "busy"
      | "no_callees"
      | "callee_not_allowed",
  ) {
    super(`Call rejected: ${reason}`);
  }
}

export type CallPolicy = { enabled: boolean; minutesPerDay: number; maxSec?: number };

export type Permit =
  | { kind: "start"; permitId: string; calleeIds: string[]; maxSec: number }
  | { kind: "join"; permitId: string; callId: string };

type GateRow = { id: string; teamId: string; status: string };

async function lockOpenGate(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  gateId: string,
  userId: string,
): Promise<GateRow> {
  const [gate] = await tx.$queryRaw<GateRow[]>`
    SELECT id, "teamId", status FROM gates WHERE id = ${gateId} FOR UPDATE`;
  if (!gate) throw new CallRejectedError("not_found");
  const member = await tx.membership.findUnique({
    where: { teamId_userId: { teamId: gate.teamId, userId } },
    select: { role: true },
  });
  if (!member) throw new CallRejectedError("not_found");
  if (gate.status !== "pending" && gate.status !== "parked") {
    throw new CallRejectedError("closed");
  }
  return gate;
}

async function assertBudget(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  teamId: string,
  policy: CallPolicy,
  maxSec: number,
  now: Date,
) {
  const calls = await tx.callSession.findMany({
    where: { teamId, createdAt: { gte: startOfUtcDay(now) } },
    select: { status: true, maxSec: true, durationSec: true },
  });
  if (!withinBudget({ calls, nextMaxSec: maxSec, minutesPerDay: policy.minutesPerDay })) {
    throw new CallRejectedError("budget");
  }
}

// One open huddle per gate. A second person asking gets the live callId to join instead.
export async function requestHuddlePermit(
  db: PrismaClient,
  input: {
    gateId: string;
    userId: string;
    onlineMemberIds: string[]; // Nexconn user ids of members to ring, from the caller's view
    policy: CallPolicy;
    newId: () => string;
    now?: Date;
  },
): Promise<Permit> {
  if (!input.policy.enabled) throw new CallRejectedError("calls_disabled");
  const now = input.now ?? new Date();
  const maxSec = input.policy.maxSec ?? DEFAULT_MAX_CALL_SEC;

  return db.$transaction(async (tx) => {
    const gate = await lockOpenGate(tx, input.gateId, input.userId);

    const open = await tx.callSession.findFirst({
      where: { gateId: gate.id, kind: "huddle", status: { in: ["permitted", "live"] } },
      orderBy: { createdAt: "desc" },
    });
    if (open?.status === "live" && open.callId) {
      return { kind: "join", permitId: open.id, callId: open.callId } as const;
    }
    if (open?.status === "permitted") {
      if (now.getTime() - open.createdAt.getTime() < PERMIT_STALE_MS) {
        throw new CallRejectedError("busy");
      }
      await tx.callSession.update({ where: { id: open.id }, data: { status: "failed" } });
    }

    const members = await tx.membership.findMany({
      where: { teamId: gate.teamId, userId: { not: input.userId } },
      select: { user: { select: { nexconnUserId: true } } },
    });
    const allowed = new Set(members.map((m) => m.user.nexconnUserId).filter(Boolean));
    const calleeIds = [...new Set(input.onlineMemberIds)].filter((id) => allowed.has(id));
    if (calleeIds.length === 0) throw new CallRejectedError("no_callees");

    await assertBudget(tx, gate.teamId, input.policy, maxSec, now);
    const session = await tx.callSession.create({
      data: {
        id: input.newId(),
        teamId: gate.teamId,
        gateId: gate.id,
        kind: "huddle",
        startedById: input.userId,
        calleeIds,
        maxSec,
      },
    });
    return { kind: "start", permitId: session.id, calleeIds, maxSec } as const;
  });
}

// "Ring Ana": a 1:1 call to one member who can approve.
export async function requestRingPermit(
  db: PrismaClient,
  input: {
    gateId: string;
    userId: string;
    calleeUserId: string;
    policy: CallPolicy;
    newId: () => string;
    now?: Date;
  },
): Promise<Permit> {
  if (!input.policy.enabled) throw new CallRejectedError("calls_disabled");
  const now = input.now ?? new Date();
  const maxSec = input.policy.maxSec ?? DEFAULT_MAX_CALL_SEC;
  if (input.calleeUserId === input.userId) throw new CallRejectedError("callee_not_allowed");

  return db.$transaction(async (tx) => {
    const gate = await lockOpenGate(tx, input.gateId, input.userId);
    const callee = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: gate.teamId, userId: input.calleeUserId } },
      select: { role: true, user: { select: { nexconnUserId: true } } },
    });
    if (!callee || !canVote(callee.role as TeamRoleValue) || !callee.user.nexconnUserId) {
      throw new CallRejectedError("callee_not_allowed");
    }
    await assertBudget(tx, gate.teamId, input.policy, maxSec, now);
    const session = await tx.callSession.create({
      data: {
        id: input.newId(),
        teamId: gate.teamId,
        gateId: gate.id,
        kind: "ring",
        startedById: input.userId,
        calleeIds: [callee.user.nexconnUserId],
        maxSec,
      },
    });
    return {
      kind: "start",
      permitId: session.id,
      calleeIds: [callee.user.nexconnUserId],
      maxSec,
    } as const;
  });
}

// The starter's browser reports the callId once startCall succeeded.
export async function markCallLive(
  db: PrismaClient,
  input: { permitId: string; userId: string; callId: string; now?: Date },
): Promise<CallSession | null> {
  const { count } = await db.callSession.updateMany({
    where: { id: input.permitId, startedById: input.userId, status: "permitted" },
    data: {
      status: "live",
      callId: input.callId,
      startedAt: input.now ?? new Date(),
      participants: [input.userId],
    },
  });
  if (count === 0) return null;
  return db.callSession.findUnique({ where: { id: input.permitId } });
}

export async function markCallJoined(
  db: PrismaClient,
  input: { permitId: string; userId: string },
): Promise<CallSession | null> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string; teamId: string; participants: string[] }[]>`
      SELECT id, "teamId", participants FROM call_sessions
      WHERE id = ${input.permitId} AND status = 'live' FOR UPDATE`;
    if (!row) return null;
    const member = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: row.teamId, userId: input.userId } },
      select: { role: true },
    });
    if (!member) return null;
    if (row.participants.includes(input.userId)) {
      return tx.callSession.findUnique({ where: { id: row.id } });
    }
    return tx.callSession.update({
      where: { id: row.id },
      data: { participants: { push: input.userId } },
    });
  });
}

// Any participant may report the end; the first report wins and later ones are no-ops.
export async function markCallEnded(
  db: PrismaClient,
  input: { permitId: string; userId: string; durationSec: number; now?: Date },
): Promise<CallSession | null> {
  const session = await db.callSession.findUnique({ where: { id: input.permitId } });
  if (!session || session.status !== "live") return null;
  if (session.startedById !== input.userId && !session.participants.includes(input.userId)) {
    return null;
  }
  const { count } = await db.callSession.updateMany({
    where: { id: session.id, status: "live" },
    data: {
      status: "ended",
      endedAt: input.now ?? new Date(),
      durationSec: clampDuration(input.durationSec, session.maxSec),
    },
  });
  return count === 1 ? db.callSession.findUnique({ where: { id: session.id } }) : null;
}

// Backstop for browsers that vanish: abandoned permits fail, overrunning calls are closed at
// their cap (the client ends them at maxSec; this only fixes the record).
export async function sweepCalls(db: PrismaClient, now: Date = new Date()) {
  const failed = await db.callSession.updateMany({
    where: { status: "permitted", createdAt: { lt: new Date(now.getTime() - PERMIT_STALE_MS) } },
    data: { status: "failed" },
  });
  const overdue = await db.callSession.findMany({
    where: { status: "live", startedAt: { not: null } },
    select: { id: true, startedAt: true, maxSec: true },
  });
  let ended = 0;
  for (const call of overdue) {
    const deadline = call.startedAt!.getTime() + (call.maxSec + END_GRACE_SEC) * 1000;
    if (deadline > now.getTime()) continue;
    const { count } = await db.callSession.updateMany({
      where: { id: call.id, status: "live" },
      data: { status: "ended", endedAt: now, durationSec: call.maxSec },
    });
    ended += count;
  }
  return { failed: failed.count, ended };
}
