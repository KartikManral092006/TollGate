import { sendGroupMessage, setMessageMetadata } from "@/features/nexconn/server/api";
import { SYSTEM_USER_ID } from "@/features/nexconn/shared/config";
import {
  agentMetadata,
  encodeContent,
  TG,
  type AgentCardPayload,
  type AgentTally,
} from "@/features/nexconn/shared/messages";
import { ensureGroupFor, type CardDeps } from "@/features/gates/server/cards";

const GROUP_CHANNEL_TYPE = 3;
// Marks a card being posted, so two gates arriving together post it once.
const POSTING = "posting";

export async function sessionTally(
  db: CardDeps["db"],
  teamId: string,
  sessionId: string,
): Promise<AgentTally & { lastCode: number | null }> {
  const [rows, last] = await Promise.all([
    db.gate.groupBy({ by: ["status"], where: { teamId, sessionId }, _count: { _all: true } }),
    db.gate.findFirst({
      where: { teamId, sessionId },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    }),
  ]);
  const count = (...statuses: string[]) =>
    rows.filter((row) => statuses.includes(row.status)).reduce((n, row) => n + row._count._all, 0);
  return {
    raised: count("pending", "parked", "approved", "denied", "expired"),
    waiting: count("pending", "parked"),
    approved: count("approved"),
    denied: count("denied"),
    lastCode: last?.code ?? null,
  };
}

// Keeps one TG:Agent card per Claude Code session in the team's room: posted by the bot on the
// session's first gate, its counts updated as gates arrive and get decided. The bot sends and
// never connects, so a session adds no Nexconn user. Gates without a session id are skipped.
export async function syncAgentSession(
  deps: CardDeps,
  gateId: string,
  newId: () => string,
): Promise<void> {
  const gate = await deps.db.gate.findUnique({
    where: { id: gateId },
    select: {
      teamId: true,
      sessionId: true,
      repoId: true,
      requesterId: true,
      repo: { select: { name: true } },
    },
  });
  if (!gate?.sessionId) return;
  const key = { teamId_sessionId: { teamId: gate.teamId, sessionId: gate.sessionId } };

  await deps.db.agentSession.createMany({
    data: [
      {
        id: newId(),
        teamId: gate.teamId,
        sessionId: gate.sessionId,
        repoId: gate.repoId,
        requesterId: gate.requesterId,
      },
    ],
    skipDuplicates: true,
  });
  const session = await deps.db.agentSession.update({
    where: key,
    data: { lastSeenAt: new Date() },
  });
  const tally = await sessionTally(deps.db, gate.teamId, gate.sessionId);
  const metadata = agentMetadata({ ...tally, lastSeenAt: session.lastSeenAt });

  if (session.messageId === null) {
    const { count } = await deps.db.agentSession.updateMany({
      where: { id: session.id, messageId: null },
      data: { messageId: POSTING },
    });
    if (count === 0) return;
    try {
      const { team, requesterName, requesterNexconnId } = await ensureGroupFor(
        deps,
        gate.teamId,
        session.requesterId,
      );
      const card: AgentCardPayload = {
        sessionKey: session.id,
        repo: gate.repo.name,
        requester: requesterName,
        requesterId: requesterNexconnId,
        startedAt: session.createdAt.getTime(),
      };
      const sent = await sendGroupMessage(deps.client, {
        fromUserId: SYSTEM_USER_ID,
        toChannelIds: [team.nexconnChannelId],
        messageType: TG.Agent,
        content: encodeContent(card),
        isEchoToSender: 0,
        hasMetadata: true,
        metadata,
      });
      await deps.db.agentSession.update({
        where: { id: session.id },
        data: { messageId: sent.messageIds[0]?.messageId ?? null },
      });
    } catch (error) {
      // Free the claim so the session's next gate tries again.
      await deps.db.agentSession.update({ where: { id: session.id }, data: { messageId: null } });
      throw error;
    }
    return;
  }
  if (session.messageId === POSTING) return;

  const team = await deps.db.team.findUniqueOrThrow({
    where: { id: gate.teamId },
    select: { nexconnChannelId: true },
  });
  await setMessageMetadata(deps.client, {
    messageId: session.messageId,
    userId: SYSTEM_USER_ID,
    channelType: GROUP_CHANNEL_TYPE,
    channelId: team.nexconnChannelId,
    metadata,
  });
}
