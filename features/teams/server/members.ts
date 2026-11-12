import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

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

// Everything someone leaving the team could still use, switched off:
// - their hook tokens for this team's repos are revoked (their agent's risky commands block);
// - approval windows they opened, or that cover their agent, end now;
// - their votes on gates still open are withdrawn, so someone who's gone can't help approve;
// - their own open gates expire, as nobody is left to run them;
// - invite links they made stop working;
// - the membership goes. Decided gates and past votes stay in the audit log.
async function switchOff(
  tx: Prisma.TransactionClient,
  input: { teamId: string; userId: string; endedById: string; now: Date },
) {
  const open = { in: ["pending", "parked"] as ("pending" | "parked")[] };
  const tokens = await tx.hookToken.updateMany({
    where: { createdById: input.userId, revokedAt: null, repo: { teamId: input.teamId } },
    data: { revokedAt: input.now },
  });
  const windows = await tx.approvalWindow.updateMany({
    where: {
      teamId: input.teamId,
      endedAt: null,
      expiresAt: { gt: input.now },
      OR: [{ createdById: input.userId }, { requesterId: input.userId }],
    },
    data: { endedAt: input.now, endedById: input.endedById },
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
    data: { revokedAt: input.now },
  });
  await tx.membership.delete({
    where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
  });
  return {
    tokens: tokens.count,
    windows: windows.count,
    votes: votes.count,
    gates: gates.count,
    invites: invites.count,
  };
}

// The owner removes someone from the team, in one transaction so nothing is left half done.
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

    const counts = await switchOff(tx, {
      teamId: input.teamId,
      userId: input.userId,
      endedById: input.actorId,
      now,
    });
    return { userId: input.userId, nexconnUserId: target.user.nexconnUserId, ...counts };
  });
}

export class LeaveTeamError extends Error {
  override readonly name = "LeaveTeamError";

  constructor(readonly reason: "not_member" | "owner") {
    super(`Can't leave team: ${reason}`);
  }
}

// Someone takes themselves out of a team they no longer need, with the same switch-offs as a
// removal. An owner can't leave: the team would have nobody to manage it, so they delete it.
export async function leaveTeam(
  db: PrismaClient,
  input: { teamId: string; userId: string; now?: Date },
): Promise<RemovedMember> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
      select: { role: true, user: { select: { nexconnUserId: true } } },
    });
    if (!membership) throw new LeaveTeamError("not_member");
    if (membership.role === "owner") throw new LeaveTeamError("owner");
    const counts = await switchOff(tx, {
      teamId: input.teamId,
      userId: input.userId,
      endedById: input.userId,
      now,
    });
    return { userId: input.userId, nexconnUserId: membership.user.nexconnUserId, ...counts };
  });
}
