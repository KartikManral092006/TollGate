import type { PrismaClient } from "@/lib/generated/prisma/client";
import { hashSecret, isWellFormedSecret, mintSecret, secretPrefix } from "@/lib/secret-token";

const LAST_USED_RESOLUTION_MS = 60_000;

export async function mintHookToken(
  db: PrismaClient,
  input: { id: string; repoId: string; createdById: string },
): Promise<{ token: string; prefix: string }> {
  const token = mintSecret("tg");
  await db.hookToken.create({
    data: {
      id: input.id,
      repoId: input.repoId,
      createdById: input.createdById,
      tokenHash: hashSecret(token),
      prefix: secretPrefix(token),
    },
  });
  return { token, prefix: secretPrefix(token) };
}

export type HookPrincipal = {
  tokenId: string;
  repoId: string;
  repoName: string;
  teamId: string;
  mode: "guard" | "delegate";
  presets: unknown;
  requesterId: string;
};

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

// The token may only act for its own repo, and only while its creator is still on the team.
export async function authenticateHookToken(
  db: PrismaClient,
  authorization: string | null,
  now: Date = new Date(),
): Promise<HookPrincipal | null> {
  const token = bearerToken(authorization);
  if (!token || !isWellFormedSecret(token, "tg")) return null;

  // One joined query, as every waiting hook calls this every 2 s: the token, its repo, and
  // the creator's membership of the team that owns this token's repo (empty once they left).
  const tokenHash = hashSecret(token);
  const row = await db.hookToken.findUnique({
    where: { tokenHash },
    include: {
      repo: true,
      createdBy: {
        select: {
          memberships: {
            where: { team: { repos: { some: { tokens: { some: { tokenHash } } } } } },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!row || row.revokedAt) return null;
  if (row.createdBy.memberships.length === 0) return null;

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.hookToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }

  return {
    tokenId: row.id,
    repoId: row.repoId,
    repoName: row.repo.name,
    teamId: row.repo.teamId,
    mode: row.repo.mode,
    presets: row.repo.presets,
    requesterId: row.createdById,
  };
}

export async function revokeHookToken(
  db: PrismaClient,
  input: { tokenId: string; teamId: string },
): Promise<boolean> {
  const { count } = await db.hookToken.updateMany({
    where: { id: input.tokenId, revokedAt: null, repo: { teamId: input.teamId } },
    data: { revokedAt: new Date() },
  });
  return count === 1;
}
