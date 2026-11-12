import type { PrismaClient } from "@/lib/generated/prisma/client";
import { classifyGate } from "@/features/gates/server/gates";
import type { HookPrincipal } from "@/features/gates/server/hook-tokens";
import type { ReportBypassInput } from "@/features/gates/shared/hook-api";
import { redact, truncate } from "@/features/gates/shared/redact";
import { canVote, type TeamRoleValue } from "@/features/teams/shared/schemas";

// A report that sat in an offline laptop's queue longer than this is still recorded, dated now.
export const BYPASS_MAX_AGE_MS = 7 * 86_400_000;

// Records a call that went through with TOLLGATE_BYPASS=1 as a gate of its own: it ran, nobody
// decided, and the team should look at it afterwards. Idempotent on the hook's id, so a report
// retried from the queue never shows up twice. Returns the gate and whether it is new.
export async function recordBypass(
  db: PrismaClient,
  principal: HookPrincipal,
  input: ReportBypassInput,
  now: Date = new Date(),
): Promise<{ gate: { id: string; code: number; teamId: string }; created: boolean } | null> {
  const existing = await db.gate.findUnique({
    where: { id: input.id },
    select: { id: true, code: true, teamId: true, repoId: true },
  });
  if (existing) {
    if (existing.repoId !== principal.repoId) return null;
    return {
      gate: { id: existing.id, code: existing.code, teamId: existing.teamId },
      created: false,
    };
  }

  const at =
    input.at > now.getTime() || now.getTime() - input.at > BYPASS_MAX_AGE_MS
      ? now
      : new Date(input.at);
  const classified = classifyGate(principal, input);

  try {
    const gate = await db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ code: number }[]>`
        UPDATE teams SET "nextGateCode" = "nextGateCode" + 1, "updatedAt" = now()
        WHERE id = ${principal.teamId}
        RETURNING "nextGateCode" - 1 AS code`;
      if (!row) throw new Error("Team not found for hook token");
      return tx.gate.create({
        data: {
          id: input.id,
          code: Number(row.code),
          teamId: principal.teamId,
          repoId: principal.repoId,
          requesterId: principal.requesterId,
          ...classified.columns,
          branch: input.branch ? truncate(redact(input.branch).text, 200) : null,
          sessionId: input.sessionId ? truncate(input.sessionId, 200) : null,
          redactions: input.redactions + classified.redactions,
          cmdHash: input.cmdHash,
          quorum: classified.presetQuorum,
          status: "bypassed",
          decidedAt: at,
          createdAt: at,
        },
        select: { id: true, code: true, teamId: true },
      });
    });
    return { gate, created: true };
  } catch (error) {
    // Two copies of the same report raced: the other one recorded it.
    if ((error as { code?: string }).code === "P2002") {
      const again = await db.gate.findUnique({
        where: { id: input.id },
        select: { id: true, code: true, teamId: true },
      });
      return again ? { gate: again, created: false } : null;
    }
    throw error;
  }
}

export class ReviewRejectedError extends Error {
  override readonly name = "ReviewRejectedError";

  constructor(readonly reason: "not_found" | "not_bypassed" | "own_gate" | "not_allowed") {
    super(`Review rejected: ${reason}`);
  }
}

// Someone who can vote (not the person whose agent it was) says they've looked at a bypass.
// Reviewing twice keeps the first review. Returns the gate's team, for the room to refresh.
export async function reviewBypass(
  db: PrismaClient,
  input: { gateId: string; userId: string; note?: string | null; now?: Date },
): Promise<{ teamId: string; reviewedNow: boolean }> {
  const gate = await db.gate.findUnique({
    where: { id: input.gateId },
    select: { teamId: true, status: true, requesterId: true },
  });
  if (!gate) throw new ReviewRejectedError("not_found");
  const member = await db.membership.findUnique({
    where: { teamId_userId: { teamId: gate.teamId, userId: input.userId } },
    select: { role: true },
  });
  if (!member) throw new ReviewRejectedError("not_found");
  if (gate.status !== "bypassed") throw new ReviewRejectedError("not_bypassed");
  if (gate.requesterId === input.userId) throw new ReviewRejectedError("own_gate");
  if (!canVote(member.role as TeamRoleValue)) throw new ReviewRejectedError("not_allowed");

  const note = input.note?.trim() ? truncate(redact(input.note.trim()).text, 500) : null;
  const { count } = await db.gate.updateMany({
    where: { id: input.gateId, status: "bypassed", reviewedAt: null },
    data: { reviewedAt: input.now ?? new Date(), reviewedById: input.userId, reviewNote: note },
  });
  return { teamId: gate.teamId, reviewedNow: count === 1 };
}
