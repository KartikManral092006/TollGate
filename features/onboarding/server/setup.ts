import type { PrismaClient } from "@/lib/generated/prisma/client";
import { setupState, type SetupState } from "@/features/onboarding/shared/steps";

export async function loadSetupState(
  db: PrismaClient,
  teamId: string,
  userId: string,
): Promise<SetupState> {
  const [user, repoCount, usedToken, gateCount, memberCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.repoLink.count({ where: { teamId } }),
    db.hookToken.findFirst({
      where: { repo: { teamId }, revokedAt: null, lastUsedAt: { not: null } },
      select: { id: true },
    }),
    db.gate.count({ where: { teamId } }),
    db.membership.count({ where: { teamId } }),
  ]);
  return setupState({
    hasName: Boolean(user?.name.trim()),
    repoCount,
    tokenUsed: usedToken !== null,
    gateCount,
    memberCount,
  });
}
