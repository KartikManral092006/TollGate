import type { PrismaClient } from "@/lib/generated/prisma/client";

export class DeleteTeamError extends Error {
  override readonly name = "DeleteTeamError";

  constructor(readonly reason: "not_found" | "not_owner" | "wrong_name") {
    super(`Can't delete team: ${reason}`);
  }
}

export type DeletedTeam = {
  name: string;
  nexconnChannelId: string;
  // The chat group was created, so it has to be dismissed too.
  hadChatGroup: boolean;
  // What went with it, for the log.
  repos: number;
  gates: number;
  members: number;
};

// The owner deletes a whole team: its room, repos and hook tokens, every gate with its votes
// and audit trail, rules, windows, invites, calls and memberships. Everything hangs off the
// team with ON DELETE CASCADE, so one delete removes it all or nothing. The owner types the
// team's name, so a team is never deleted by a slip of the mouse or a forged request.
export async function deleteTeam(
  db: PrismaClient,
  input: { teamId: string; actorId: string; confirmName: string },
): Promise<DeletedTeam> {
  return db.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: input.teamId },
      select: {
        name: true,
        nexconnChannelId: true,
        nexconnGroupReadyAt: true,
        memberships: { where: { userId: input.actorId }, select: { role: true } },
        _count: { select: { repos: true, gates: true, memberships: true } },
      },
    });
    if (!team || team.memberships.length === 0) throw new DeleteTeamError("not_found");
    if (team.memberships[0]?.role !== "owner") throw new DeleteTeamError("not_owner");
    if (input.confirmName.trim() !== team.name.trim()) throw new DeleteTeamError("wrong_name");

    await tx.team.delete({ where: { id: input.teamId } });
    return {
      name: team.name,
      nexconnChannelId: team.nexconnChannelId,
      hadChatGroup: team.nexconnGroupReadyAt !== null,
      repos: team._count.repos,
      gates: team._count.gates,
      members: team._count.memberships,
    };
  });
}
