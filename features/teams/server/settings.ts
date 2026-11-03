import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName } from "@/features/gates/shared/view";

export type TokenRow = {
  id: string;
  prefix: string;
  createdBy: string;
  mine: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export type RepoRow = { id: string; name: string; mode: "guard" | "delegate"; tokens: TokenRow[] };

export type InviteRow = {
  id: string;
  role: string;
  uses: number;
  maxUses: number;
  expiresAt: string;
};

// Only token prefixes leave the server; the hashes and plaintexts never do.
export async function loadSettings(
  db: PrismaClient,
  teamId: string,
  viewerId: string,
  now = new Date(),
) {
  const [repos, invites] = await Promise.all([
    db.repoLink.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
      include: {
        tokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    }),
    db.invite.findMany({
      where: { teamId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    repos: repos.map((repo): RepoRow => ({
      id: repo.id,
      name: repo.name,
      mode: repo.mode,
      tokens: repo.tokens.map((token) => ({
        id: token.id,
        prefix: token.prefix,
        createdBy: displayName(token.createdBy.name, token.createdBy.id),
        mine: token.createdById === viewerId,
        createdAt: token.createdAt.toISOString(),
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      })),
    })),
    invites: invites
      .filter((invite) => invite.uses < invite.maxUses)
      .map((invite): InviteRow => ({
        id: invite.id,
        role: invite.role,
        uses: invite.uses,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt.toISOString(),
      })),
  };
}
