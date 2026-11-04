import type { PrismaClient } from "@/lib/generated/prisma/client";
import { setupState, type SetupState } from "@/features/onboarding/shared/steps";

export async function loadSetupState(
  db: PrismaClient,
  teamId: string,
  userId: string,
): Promise<SetupState> {
  const [user, repoCount, usedToken, gateCount, memberCount, outsideVotes, waitingGate] =
    await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
      db.repoLink.count({ where: { teamId } }),
      db.hookToken.findFirst({
        where: { repo: { teamId }, revokedAt: null, lastUsedAt: { not: null } },
        select: { id: true },
      }),
      db.gate.count({ where: { teamId } }),
      db.membership.count({ where: { teamId } }),
      // Prisma can't compare two columns, so this one is SQL.
      db.$queryRaw<{ one: number }[]>`SELECT 1 AS one FROM votes v
        JOIN gates g ON g.id = v."gateId"
        WHERE g."teamId" = ${teamId} AND v."userId" <> g."requesterId" LIMIT 1`,
      db.gate.findFirst({
        where: { teamId, requesterId: userId, status: { in: ["pending", "parked"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, code: true },
      }),
    ]);
  return setupState({
    hasName: Boolean(user?.name.trim()),
    repoCount,
    tokenUsed: usedToken !== null,
    gateCount,
    memberCount,
    outsideVote: outsideVotes.length > 0,
    waitingGate,
  });
}
