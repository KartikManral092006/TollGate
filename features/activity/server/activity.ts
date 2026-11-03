import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName } from "@/features/gates/shared/view";
import { activityEvents, type ActivityEvent } from "@/features/activity/shared/activity";

const DAYS = 7;

// The last week of gates across your teams, turned into a feed.
export async function loadActivity(db: PrismaClient, userId: string): Promise<ActivityEvent[]> {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const gates = await db.gate.findMany({
    where: { team: { memberships: { some: { userId } } }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      code: true,
      teamId: true,
      status: true,
      question: true,
      createdAt: true,
      parkedAt: true,
      decidedAt: true,
      team: { select: { name: true } },
      requester: { select: { id: true, name: true } },
      policyRule: { select: { action: true } },
      votes: {
        select: {
          userId: true,
          decision: true,
          reason: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });
  return activityEvents(
    gates.map((gate) => ({
      id: gate.id,
      code: gate.code,
      teamId: gate.teamId,
      teamName: gate.team.name,
      requester: {
        id: gate.requester.id,
        name: displayName(gate.requester.name, gate.requester.id),
      },
      status: gate.status,
      question: gate.question,
      createdAt: gate.createdAt.toISOString(),
      parkedAt: gate.parkedAt?.toISOString() ?? null,
      decidedAt: gate.decidedAt?.toISOString() ?? null,
      autoApproved: gate.policyRule?.action === "auto_approve",
      votes: gate.votes.map((vote) => ({
        userId: vote.userId,
        name: displayName(vote.user.name, vote.userId),
        decision: vote.decision,
        reason: vote.reason,
        at: vote.createdAt.toISOString(),
      })),
    })),
    userId,
  );
}
