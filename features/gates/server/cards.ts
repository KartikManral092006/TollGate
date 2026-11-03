import type { PrismaClient } from "@/lib/generated/prisma/client";
import { nexconnDisplayName } from "@/features/auth/shared/display-name";
import type { NexconnClient } from "@/features/nexconn/server/client";
import { sendGroupMessage, setMessageMetadata } from "@/features/nexconn/server/api";
import { SYSTEM_USER_ID } from "@/features/nexconn/shared/config";
import {
  encodeContent,
  gateMetadata,
  huddleMetadata,
  TG,
  type GateCardPayload,
  type HuddleCardPayload,
} from "@/features/nexconn/shared/messages";
import { ensureTeamChat, type TeamChatDeps } from "@/features/teams/server/team-chat";

const GROUP_CHANNEL_TYPE = 3;

export type CardDeps = { db: PrismaClient; client: NexconnClient; teamChat: TeamChatDeps };

async function ensureGroupFor(deps: CardDeps, teamId: string, userId: string) {
  const team = await deps.db.team.findUniqueOrThrow({ where: { id: teamId } });
  const user = await deps.db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, nexconnUserId: true },
  });
  if (!user.nexconnUserId) throw new Error("User has no Nexconn ID");
  const name = nexconnDisplayName({ name: user.name, nexconnUserId: user.nexconnUserId });
  const result = await ensureTeamChat(deps.teamChat, team, {
    id: user.id,
    nexconnUserId: user.nexconnUserId,
    name,
  });
  if (result.chat !== "ok") throw new Error("Team group is full");
  return { team, requesterName: name, requesterNexconnId: user.nexconnUserId };
}

// The bot sends; it never connects, so it never counts as an active user.
export async function postGateCard(deps: CardDeps, gateId: string): Promise<string | null> {
  const gate = await deps.db.gate.findUniqueOrThrow({
    where: { id: gateId },
    include: { repo: { select: { name: true } } },
  });
  if (gate.messageId) return gate.messageId;
  const { team, requesterName, requesterNexconnId } = await ensureGroupFor(
    deps,
    gate.teamId,
    gate.requesterId,
  );

  const card: GateCardPayload = {
    gateId: gate.id,
    code: gate.code,
    preset: gate.preset,
    env: gate.env,
    repo: gate.repo.name,
    branch: gate.branch,
    cmd: gate.command,
    ctx: gate.context,
    redactions: gate.redactions,
    quorum: gate.quorum,
    requester: requesterName,
    requesterId: requesterNexconnId,
  };
  const sent = await sendGroupMessage(deps.client, {
    fromUserId: SYSTEM_USER_ID,
    toChannelIds: [team.nexconnChannelId],
    messageType: TG.Gate,
    content: encodeContent(card),
    isEchoToSender: 0,
    hasMetadata: true,
    metadata: gateMetadata({
      status: gate.status,
      approvals: 0,
      quorum: gate.quorum,
      votes: [],
    }),
  });
  const messageId = sent.messageIds[0]?.messageId ?? null;
  if (messageId) {
    await deps.db.gate.updateMany({
      where: { id: gate.id, messageId: null },
      data: { messageId },
    });
  }
  return messageId;
}

// Always written after the Postgres commit, from the committed row, so a late or repeated
// mirror can only ever show the latest truth.
export async function mirrorGateState(deps: CardDeps, gateId: string): Promise<void> {
  const gate = await deps.db.gate.findUnique({
    where: { id: gateId },
    include: {
      team: { select: { nexconnChannelId: true } },
      votes: {
        orderBy: { createdAt: "asc" },
        select: { decision: true, user: { select: { nexconnUserId: true } } },
      },
      grant: { select: { expiresAt: true } },
    },
  });
  if (!gate?.messageId) return;
  const votes = gate.votes.flatMap((vote) =>
    vote.user.nexconnUserId ? [{ userId: vote.user.nexconnUserId, decision: vote.decision }] : [],
  );
  const decider = gate.decidedById
    ? await deps.db.user.findUnique({
        where: { id: gate.decidedById },
        select: { nexconnUserId: true },
      })
    : null;
  await setMessageMetadata(deps.client, {
    messageId: gate.messageId,
    userId: SYSTEM_USER_ID,
    channelType: GROUP_CHANNEL_TYPE,
    channelId: gate.team.nexconnChannelId,
    metadata: gateMetadata({
      status: gate.status,
      approvals: votes.filter((vote) => vote.decision === "approve").length,
      quorum: gate.quorum,
      votes,
      decidedBy: decider?.nexconnUserId ?? null,
      grantExpiresAt: gate.grant?.expiresAt ?? null,
    }),
  });
}

export async function postHuddleCard(deps: CardDeps, permitId: string): Promise<string | null> {
  const call = await deps.db.callSession.findUniqueOrThrow({
    where: { id: permitId },
    include: {
      gate: { select: { code: true } },
      startedBy: { select: { name: true, nexconnUserId: true } },
    },
  });
  if (!call.callId || call.messageId) return call.messageId;
  const { team } = await ensureGroupFor(deps, call.teamId, call.startedById);
  const starterId = call.startedBy.nexconnUserId ?? call.startedById;

  const card: HuddleCardPayload = {
    callId: call.callId,
    kind: call.kind,
    gateId: call.gateId,
    code: call.gate?.code ?? null,
    startedBy: nexconnDisplayName({ name: call.startedBy.name, nexconnUserId: starterId }),
    startedById: starterId,
  };
  const sent = await sendGroupMessage(deps.client, {
    fromUserId: SYSTEM_USER_ID,
    toChannelIds: [team.nexconnChannelId],
    messageType: TG.Huddle,
    content: encodeContent(card),
    isEchoToSender: 0,
    hasMetadata: true,
    metadata: huddleMetadata({ live: true, participants: call.participants.length }),
  });
  const messageId = sent.messageIds[0]?.messageId ?? null;
  if (messageId) {
    await deps.db.callSession.updateMany({
      where: { id: call.id, messageId: null },
      data: { messageId },
    });
  }
  return messageId;
}

export async function mirrorHuddleState(deps: CardDeps, permitId: string): Promise<void> {
  const call = await deps.db.callSession.findUnique({
    where: { id: permitId },
    include: { team: { select: { nexconnChannelId: true } } },
  });
  if (!call?.messageId) return;
  await setMessageMetadata(deps.client, {
    messageId: call.messageId,
    userId: SYSTEM_USER_ID,
    channelType: GROUP_CHANNEL_TYPE,
    channelId: call.team.nexconnChannelId,
    metadata: huddleMetadata({
      live: call.status === "live",
      participants: call.participants.length,
      durationSec: call.durationSec,
    }),
  });
}
