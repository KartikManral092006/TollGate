import type { PrismaClient, TeamRole } from "@/lib/generated/prisma/client";
import { toNexconnId } from "@/features/nexconn/shared/ids";
import { hashSecret, mintSecret } from "@/lib/secret-token";

export function teamChannelId(teamId: string): string {
  return toNexconnId(`tg${teamId}`);
}

export async function createTeam(
  db: PrismaClient,
  input: { id: string; name: string; ownerId: string },
) {
  return db.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        id: input.id,
        name: input.name,
        nexconnChannelId: teamChannelId(input.id),
        createdById: input.ownerId,
      },
    });
    await tx.membership.create({
      data: { teamId: team.id, userId: input.ownerId, role: "owner" },
    });
    return team;
  });
}

export function getMembership(db: PrismaClient, teamId: string, userId: string) {
  return db.membership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
}

export function listTeamsForUser(db: PrismaClient, userId: string, take = 20) {
  return db.membership.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    take,
    include: { team: { include: { _count: { select: { memberships: true, gates: true } } } } },
  });
}

export function listMembers(db: PrismaClient, teamId: string) {
  return db.membership.findMany({
    where: { teamId },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, name: true, nexconnUserId: true, image: true } } },
  });
}

export async function createInvite(
  db: PrismaClient,
  input: {
    id: string;
    teamId: string;
    createdById: string;
    role: Extract<TeamRole, "approver" | "guest">;
    maxUses: number;
    ttlHours: number;
    now?: Date;
  },
): Promise<{ token: string; expiresAt: Date }> {
  const token = mintSecret("inv");
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.ttlHours * 3_600_000);
  await db.invite.create({
    data: {
      id: input.id,
      teamId: input.teamId,
      tokenHash: hashSecret(token),
      role: input.role,
      createdById: input.createdById,
      maxUses: input.maxUses,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export type AcceptResult =
  | { ok: true; teamId: string; joinedNow: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used_up" };

// Locks the invite row so concurrent accepts can't push `uses` past maxUses. Someone who is
// already a member gets in without spending a use.
export async function acceptInvite(
  db: PrismaClient,
  input: { token: string; userId: string; now?: Date },
): Promise<AcceptResult> {
  const tokenHash = hashSecret(input.token);
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string;
        teamId: string;
        role: TeamRole;
        uses: number;
        maxUses: number;
        expiresAt: Date;
        revokedAt: Date | null;
      }[]
    >`SELECT id, "teamId", role, uses, "maxUses", "expiresAt", "revokedAt"
      FROM invites WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    const invite = rows[0];
    if (!invite || invite.revokedAt) return { ok: false, reason: "invalid" } as const;

    const existing = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: input.userId } },
      select: { role: true },
    });
    if (existing) return { ok: true, teamId: invite.teamId, joinedNow: false } as const;

    if (invite.expiresAt <= now) return { ok: false, reason: "expired" } as const;
    if (invite.uses >= invite.maxUses) return { ok: false, reason: "used_up" } as const;

    await tx.membership.create({
      data: { teamId: invite.teamId, userId: input.userId, role: invite.role },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
    return { ok: true, teamId: invite.teamId, joinedNow: true } as const;
  });
}
