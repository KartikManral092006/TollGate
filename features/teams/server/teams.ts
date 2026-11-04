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
    include: {
      team: {
        include: {
          _count: {
            select: {
              memberships: true,
              gates: { where: { status: { in: ["pending", "parked"] } } },
            },
          },
        },
      },
    },
  });
}

export function listMembers(db: PrismaClient, teamId: string) {
  return db.membership.findMany({
    where: { teamId },
    orderBy: { joinedAt: "asc" },
    include: {
      user: { select: { id: true, name: true, nexconnUserId: true, image: true } },
      invitedBy: { select: { id: true, name: true } },
    },
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
    gateId?: string;
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
      gateId: input.gateId ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

// An invite made from a waiting gate, so someone else can decide it. One person, 48 hours:
// the window in which a first gate either gets its outside vote or is forgotten, and a short
// life if the link is forwarded.
export const GATE_INVITE_TTL_HOURS = 48;

export type GateInviteResult =
  { ok: true; token: string; expiresAt: Date } | { ok: false; reason: "not_found" | "decided" };

export async function createGateInvite(
  db: PrismaClient,
  input: { id: string; teamId: string; gateId: string; createdById: string; now?: Date },
): Promise<GateInviteResult> {
  const gate = await db.gate.findFirst({
    where: { id: input.gateId, teamId: input.teamId },
    select: { status: true },
  });
  if (!gate) return { ok: false, reason: "not_found" };
  if (gate.status !== "pending" && gate.status !== "parked")
    return { ok: false, reason: "decided" };
  const invite = await createInvite(db, {
    id: input.id,
    teamId: input.teamId,
    createdById: input.createdById,
    role: "approver",
    maxUses: 1,
    ttlHours: GATE_INVITE_TTL_HOURS,
    gateId: input.gateId,
    now: input.now,
  });
  return { ok: true, ...invite };
}

export type InvitePreview = {
  status: "ok" | "expired" | "used_up";
  teamName: string;
  inviterName: string | null;
  role: TeamRole;
  expiresAt: Date;
  // The gate the invite was made for. The command itself only for the harmless test preset:
  // anyone holding the link sees this page before signing in.
  gate: {
    code: number;
    repo: string;
    env: string;
    preset: string;
    status: string;
    command: string | null;
  } | null;
};

// What the invite page shows before sign-in. Holding the token is the permission to see it;
// a revoked or unknown token shows nothing.
export async function getInvitePreview(
  db: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<InvitePreview | null> {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: {
      role: true,
      uses: true,
      maxUses: true,
      expiresAt: true,
      revokedAt: true,
      team: { select: { name: true } },
      createdBy: { select: { name: true } },
      gate: {
        select: {
          code: true,
          env: true,
          preset: true,
          status: true,
          command: true,
          repo: { select: { name: true } },
        },
      },
    },
  });
  if (!invite || invite.revokedAt) return null;
  const status =
    invite.expiresAt <= now ? "expired" : invite.uses >= invite.maxUses ? "used_up" : "ok";
  const gate = invite.gate;
  return {
    status,
    teamName: invite.team.name,
    inviterName: invite.createdBy?.name.trim() || null,
    role: invite.role,
    expiresAt: invite.expiresAt,
    gate: gate && {
      code: gate.code,
      repo: gate.repo.name,
      env: gate.env,
      preset: gate.preset,
      status: gate.status,
      command: gate.preset === "tollgate-test" ? gate.command : null,
    },
  };
}

export type AcceptResult =
  | { ok: true; teamId: string; joinedNow: boolean; gateId: string | null }
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
        createdById: string | null;
        gateId: string | null;
      }[]
    >`SELECT id, "teamId", role, uses, "maxUses", "expiresAt", "revokedAt", "createdById", "gateId"
      FROM invites WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    const invite = rows[0];
    if (!invite || invite.revokedAt) return { ok: false, reason: "invalid" } as const;

    const existing = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: input.userId } },
      select: { role: true },
    });
    const gateId = invite.gateId;
    if (existing) return { ok: true, teamId: invite.teamId, joinedNow: false, gateId } as const;

    if (invite.expiresAt <= now) return { ok: false, reason: "expired" } as const;
    if (invite.uses >= invite.maxUses) return { ok: false, reason: "used_up" } as const;

    await tx.membership.create({
      data: {
        teamId: invite.teamId,
        userId: input.userId,
        role: invite.role,
        invitedById: invite.createdById,
      },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
    return { ok: true, teamId: invite.teamId, joinedNow: true, gateId } as const;
  });
}
