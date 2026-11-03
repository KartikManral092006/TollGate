import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName, isOpenStatus, type GateView } from "@/features/gates/shared/view";
import { findPrecedent } from "@/features/insights/shared/precedent";
import { riskSignals } from "@/features/insights/shared/signals";
import type { HistoryGate } from "@/features/insights/shared/types";

const HISTORY_DAYS = 180;
const HISTORY_SIZE = 300;

// The team's recent decisions, newest first. Bounded, so a busy team's room stays fast.
export async function loadHistory(db: PrismaClient, teamId: string): Promise<HistoryGate[]> {
  const rows = await db.gate.findMany({
    where: {
      teamId,
      status: { in: ["approved", "denied"] },
      createdAt: { gte: new Date(Date.now() - HISTORY_DAYS * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_SIZE,
    select: {
      id: true,
      code: true,
      preset: true,
      env: true,
      command: true,
      status: true,
      denyReason: true,
      createdAt: true,
      decidedAt: true,
      requesterId: true,
      repo: { select: { name: true } },
      votes: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, decision: true, user: { select: { name: true } } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    repo: row.repo.name,
    preset: row.preset,
    env: row.env,
    command: row.command,
    status: row.status as HistoryGate["status"],
    denyReason: row.denyReason,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    requesterId: row.requesterId,
    votes: row.votes.map((vote) => ({
      userId: vote.userId,
      name: displayName(vote.user.name, vote.userId),
      decision: vote.decision,
    })),
  }));
}

// Only open gates get insights: they are the ones someone still has to decide. A room with
// nothing open skips the history query entirely, so polling stays cheap.
export async function withInsights(
  db: PrismaClient,
  teamId: string,
  gates: GateView[],
): Promise<GateView[]> {
  if (!gates.some((gate) => isOpenStatus(gate.status))) return gates;
  const history = await loadHistory(db, teamId);
  return gates.map((gate) =>
    isOpenStatus(gate.status)
      ? {
          ...gate,
          insights: {
            precedent: findPrecedent(gate, history),
            signals: riskSignals(gate, history),
          },
        }
      : gate,
  );
}
