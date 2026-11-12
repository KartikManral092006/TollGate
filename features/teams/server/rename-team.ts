import type { PrismaClient } from "@/lib/generated/prisma/client";

export class RenameTeamError extends Error {
  override readonly name = "RenameTeamError";

  constructor(readonly reason: "not_found" | "not_owner") {
    super(`Can't rename team: ${reason}`);
  }
}

export type RenamedTeam = {
  name: string;
  changed: boolean;
  nexconnChannelId: string;
  // The chat group exists, so its name should follow.
  hadChatGroup: boolean;
};

// The owner renames the team. The new name shows everywhere straight away; the Nexconn group's
// name is updated by the caller after the response.
export async function renameTeam(
  db: PrismaClient,
  input: { teamId: string; actorId: string; name: string },
): Promise<RenamedTeam> {
  const name = input.name.trim();
  return db.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: input.teamId },
      select: {
        name: true,
        nexconnChannelId: true,
        nexconnGroupReadyAt: true,
        memberships: { where: { userId: input.actorId }, select: { role: true } },
      },
    });
    if (!team || team.memberships.length === 0) throw new RenameTeamError("not_found");
    if (team.memberships[0]?.role !== "owner") throw new RenameTeamError("not_owner");
    const changed = team.name !== name;
    if (changed) await tx.team.update({ where: { id: input.teamId }, data: { name } });
    return {
      name,
      changed,
      nexconnChannelId: team.nexconnChannelId,
      hadChatGroup: team.nexconnGroupReadyAt !== null,
    };
  });
}
