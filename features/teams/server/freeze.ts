import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName } from "@/features/gates/shared/view";
import { redact, truncate } from "@/features/gates/shared/redact";
import { roleCanOpenWindow } from "@/features/gates/shared/windows";
import {
  FREEZE_REASON_MAX,
  freezeView,
  type FreezeKind,
  type FreezeView,
} from "@/features/teams/shared/freeze";

export class FreezeError extends Error {
  override readonly name = "FreezeError";

  constructor(readonly reason: "not_member" | "not_allowed") {
    super(`Freeze rejected: ${reason}`);
  }
}

// Owners and approvers: the people who could otherwise open approval windows.
async function requireFreezer(db: PrismaClient, teamId: string, userId: string) {
  const member = await db.membership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });
  if (!member) throw new FreezeError("not_member");
  if (!roleCanOpenWindow(member.role)) throw new FreezeError("not_allowed");
}

export async function loadFreeze(
  db: PrismaClient,
  teamId: string,
  now: Date = new Date(),
): Promise<FreezeView | null> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      freezeKind: true,
      freezeReason: true,
      freezeUntil: true,
      freezeStartedAt: true,
      freezeById: true,
    },
  });
  if (!team) return null;
  const by = team.freezeById
    ? await db.user.findUnique({ where: { id: team.freezeById }, select: { id: true, name: true } })
    : null;
  return freezeView(team, by ? displayName(by.name, by.id) : null, now);
}

// Starts a freeze, or replaces the current one (a new end time, kind or reason).
export async function startFreeze(
  db: PrismaClient,
  input: {
    teamId: string;
    userId: string;
    kind: FreezeKind;
    reason?: string | null;
    minutes: number;
    now?: Date;
  },
): Promise<FreezeView> {
  await requireFreezer(db, input.teamId, input.userId);
  const now = input.now ?? new Date();
  const reason = input.reason?.trim()
    ? truncate(redact(input.reason.trim()).text, FREEZE_REASON_MAX)
    : null;
  await db.team.update({
    where: { id: input.teamId },
    data: {
      freezeKind: input.kind,
      freezeReason: reason,
      freezeUntil: new Date(now.getTime() + input.minutes * 60_000),
      freezeStartedAt: now,
      freezeById: input.userId,
    },
  });
  return (await loadFreeze(db, input.teamId, now))!;
}

// Ends it now. Gates raised during it keep the rules they were raised under.
export async function endFreeze(
  db: PrismaClient,
  input: { teamId: string; userId: string; now?: Date },
): Promise<boolean> {
  await requireFreezer(db, input.teamId, input.userId);
  const now = input.now ?? new Date();
  const { count } = await db.team.updateMany({
    where: { id: input.teamId, freezeUntil: { gt: now } },
    data: { freezeUntil: now },
  });
  return count === 1;
}
