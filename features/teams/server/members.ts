import type { PrismaClient } from "@/lib/generated/prisma/client";

export class RemoveMemberError extends Error {
  override readonly name = "RemoveMemberError";

  constructor(readonly reason: "not_owner" | "not_member" | "self" | "owner") {
    super(`Can't remove member: ${reason}`);
  }
}

export type RemovedMember = {
  userId: string;
  nexconnUserId: string | null;
  // What their removal switched off, for the toast and the log.
  tokens: number;
  windows: number;
  votes: number;
  gates: number;
  invites: number;
};

// The owner removes someone from the team. In one transaction, so nothing is left half done:
// - their hook tokens for this team's repos are revoked (their agent's risky commands block);
// - approval windows they opened, or that cover their agent, end now;
// - their votes on gates still open are withdrawn, so someone who's gone can't help approve;
// - their own open gates expire, as nobody is left to run them;
// - invite links they made stop working;
// - the membership goes. Decided gates and past votes stay in the audit log.
// Owners can't be removed (including by themselves); a team always keeps its owner.
export async function removeMember(
  db: PrismaClient,
  input: { teamId: string; actorId: string; userId: string; now?: Date },
): Promise<RemovedMember> {
  const now = input.now ?? new Date();
  if (input.actorId === input.userId) throw new RemoveMemberError("self");

  return db.$transaction(async (tx) => {
    const [actor, target] = await Promise.all([
      tx.membership.findUnique({
        where: { teamId_userId: { teamId: input.teamId, userId: input.actorId } },
        select: { role: true },
      }),
      tx.membership.findUnique({
        where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
        select: { role: true, user: { select: { nexconnUserId: true } } },
      }),
    ]);
    if (actor?.role !== "owner") throw new RemoveMemberError("not_owner");
    if (!target) throw new RemoveMemberError("not_member");
    if (target.role === "owner") throw new RemoveMemberError("owner");

    const open = { in: ["pending", "parked"] as ("pending" | "parked")[] };
    const tokens = await tx.hookToken.updateMany({
      where: { createdById: input.userId, revokedAt: null, repo: { teamId: input.teamId } },
      data: { revokedAt: now },
    });
    const windows = await tx.approvalWindow.updateMany({
      where: {
        teamId: input.teamId,
        endedAt: null,
        expiresAt: { gt: now },
        OR: [{ createdById: input.userId }, { requesterId: input.userId }],
      },
      data: { endedAt: now, endedById: input.actorId },
    });
    const votes = await tx.vote.deleteMany({
      where: { userId: input.userId, gate: { teamId: input.teamId, status: open } },
    });
    const gates = await tx.gate.updateMany({
      where: { teamId: input.teamId, requesterId: input.userId, status: open },
      data: { status: "expired" },
    });
    const invites = await tx.invite.updateMany({
      where: { teamId: input.teamId, createdById: input.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.membership.delete({
      where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
    });

    return {
      userId: input.userId,
      nexconnUserId: target.user.nexconnUserId,
      tokens: tokens.count,
      windows: windows.count,
      votes: votes.count,
      gates: gates.count,
      invites: invites.count,
    };
  });
}
