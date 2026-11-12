import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName, displayStatus } from "@/features/gates/shared/view";
import { describeDevice, type ProfileView } from "@/features/profile/shared/profile";

// Enough for half a year of a busy person; the page says when there's more.
export const PROFILE_HISTORY_LIMIT = 1000;

// A profile is visible to its owner and to anyone who shares a team with them. A teammate
// sees only what happened in the teams they share; emails, tokens and sessions are the
// owner's alone. Anyone else gets null (a 404), so user IDs can't be probed.
export async function loadProfile(
  db: PrismaClient,
  input: { viewerId: string; targetId: string; currentSessionId: string | null; now?: Date },
): Promise<ProfileView | null> {
  const isSelf = input.viewerId === input.targetId;
  const [target, memberships, viewerTeams] = await Promise.all([
    db.user.findUnique({
      where: { id: input.targetId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    db.membership.findMany({
      where: { userId: input.targetId },
      orderBy: { joinedAt: "asc" },
      select: { role: true, joinedAt: true, team: { select: { id: true, name: true } } },
    }),
    isSelf
      ? null
      : db.membership.findMany({ where: { userId: input.viewerId }, select: { teamId: true } }),
  ]);
  if (!target) return null;

  const shared = viewerTeams ? new Set(viewerTeams.map((m) => m.teamId)) : null;
  const inScope = shared ? memberships.filter((m) => shared.has(m.team.id)) : memberships;
  if (!isSelf && inScope.length === 0) return null;

  const teamIds = inScope.map((m) => m.team.id);
  const teamName = new Map(inScope.map((m) => [m.team.id, m.team.name]));
  const now = input.now ?? new Date();

  const [gates, votes, tokens, sessions] = await Promise.all([
    db.gate.findMany({
      where: { requesterId: target.id, teamId: { in: teamIds } },
      orderBy: { createdAt: "desc" },
      take: PROFILE_HISTORY_LIMIT + 1,
      select: {
        id: true,
        code: true,
        teamId: true,
        status: true,
        question: true,
        preset: true,
        env: true,
        tool: true,
        command: true,
        createdAt: true,
        decidedAt: true,
        repo: { select: { name: true } },
      },
    }),
    db.vote.findMany({
      where: { userId: target.id, gate: { teamId: { in: teamIds } } },
      orderBy: { createdAt: "desc" },
      take: PROFILE_HISTORY_LIMIT + 1,
      select: {
        decision: true,
        reason: true,
        createdAt: true,
        gate: {
          select: {
            id: true,
            code: true,
            teamId: true,
            createdAt: true,
            command: true,
            preset: true,
            env: true,
            requesterId: true,
            requester: { select: { name: true } },
          },
        },
      },
    }),
    isSelf
      ? db.hookToken.findMany({
          where: { createdById: target.id, revokedAt: null, repo: { teamId: { in: teamIds } } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            prefix: true,
            createdAt: true,
            lastUsedAt: true,
            repo: { select: { name: true, teamId: true } },
          },
        })
      : null,
    isSelf
      ? db.session.findMany({
          where: { userId: target.id, expiresAt: { gt: now } },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, createdAt: true, updatedAt: true, userAgent: true, ipAddress: true },
        })
      : null,
  ]);

  return {
    user: {
      id: target.id,
      name: displayName(target.name, target.id),
      email: isSelf ? target.email : null,
      memberSince: target.createdAt.toISOString(),
    },
    isSelf,
    viewerId: input.viewerId,
    teams: inScope.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    gates: gates.slice(0, PROFILE_HISTORY_LIMIT).map((g) => ({
      id: g.id,
      code: g.code,
      teamId: g.teamId,
      teamName: teamName.get(g.teamId) ?? "",
      status: displayStatus(g),
      preset: g.preset,
      env: g.env,
      tool: g.tool,
      command: g.command,
      repo: g.repo.name,
      createdAt: g.createdAt.toISOString(),
      decidedAt: g.decidedAt?.toISOString() ?? null,
    })),
    votes: votes.slice(0, PROFILE_HISTORY_LIMIT).map((v) => ({
      gateId: v.gate.id,
      gateCode: v.gate.code,
      teamId: v.gate.teamId,
      teamName: teamName.get(v.gate.teamId) ?? "",
      decision: v.decision,
      reason: v.reason,
      at: v.createdAt.toISOString(),
      gateCreatedAt: v.gate.createdAt.toISOString(),
      command: v.gate.command,
      preset: v.gate.preset,
      env: v.gate.env,
      requester: {
        id: v.gate.requesterId,
        name: displayName(v.gate.requester.name, v.gate.requesterId),
      },
    })),
    truncated: gates.length > PROFILE_HISTORY_LIMIT || votes.length > PROFILE_HISTORY_LIMIT,
    tokens:
      tokens?.map((t) => ({
        id: t.id,
        prefix: t.prefix,
        repo: t.repo.name,
        teamId: t.repo.teamId,
        teamName: teamName.get(t.repo.teamId) ?? "",
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      })) ?? null,
    sessions:
      sessions?.map((s) => ({
        id: s.id,
        device: describeDevice(s.userAgent),
        ip: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.updatedAt.toISOString(),
        current: s.id === input.currentSessionId,
      })) ?? null,
  };
}
