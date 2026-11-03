import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName } from "@/features/gates/shared/view";
import type { NexconnClient } from "@/features/nexconn/server/client";
import { sendSystemMessage } from "@/features/nexconn/server/api";
import { SYSTEM_USER_ID } from "@/features/nexconn/shared/config";
import { encodeContent } from "@/features/nexconn/shared/messages";
import { gateWaitingNotice, parkedDecisionNotice } from "@/features/notify/shared/messages";

type Notice = { push: string; chat: string; subject: string; text: string; html: string };

export type NotifyDeps = {
  db: PrismaClient;
  // Null when Nexconn isn't configured: email still goes out.
  nexconn: NexconnClient | null;
  // Sends one email; false when skipped (no provider, throttled, daily cap).
  email: (to: { userId: string; address: string }, notice: Notice) => Promise<boolean>;
  gateUrl: (teamId: string, gateId: string) => string;
};

const VOTING_ROLES = ["owner", "approver", "guest"] as const;

// Nexconn system channel: a text message from the bot that shows in the app and carries
// push text for the recipients' devices.
async function systemMessage(deps: NotifyDeps, nexconnIds: string[], notice: Notice) {
  if (!deps.nexconn || nexconnIds.length === 0) return;
  for (let i = 0; i < nexconnIds.length; i += 100) {
    await sendSystemMessage(deps.nexconn, {
      fromUserId: SYSTEM_USER_ID,
      toUserIds: nexconnIds.slice(i, i + 100),
      messageType: "RC:TxtMsg",
      content: encodeContent({ content: notice.chat }),
      pushContent: notice.push,
    });
  }
}

export async function notifyGateWaiting(deps: NotifyDeps, gateId: string) {
  const gate = await deps.db.gate.findUnique({
    where: { id: gateId },
    include: {
      repo: { select: { name: true } },
      requester: { select: { id: true, name: true } },
    },
  });
  if (!gate || (gate.status !== "pending" && gate.status !== "parked")) return;

  const voters = await deps.db.membership.findMany({
    where: {
      teamId: gate.teamId,
      role: { in: [...VOTING_ROLES] },
      userId: { not: gate.requesterId },
    },
    select: { user: { select: { id: true, email: true, nexconnUserId: true } } },
  });
  const notice = gateWaitingNotice({
    code: gate.code,
    env: gate.env,
    preset: gate.preset,
    repo: gate.repo.name,
    command: gate.command,
    requester: displayName(gate.requester.name, gate.requester.id),
    quorum: gate.quorum,
    url: deps.gateUrl(gate.teamId, gate.id),
  });

  const nexconnIds = voters.flatMap((v) => (v.user.nexconnUserId ? [v.user.nexconnUserId] : []));
  await Promise.allSettled([
    systemMessage(deps, nexconnIds, notice),
    ...voters.map((v) => deps.email({ userId: v.user.id, address: v.user.email }, notice)),
  ]);
}

// Only for gates the agent had stopped waiting on: a live hook learns the outcome by polling.
export async function notifyParkedDecision(deps: NotifyDeps, gateId: string) {
  const gate = await deps.db.gate.findUnique({
    where: { id: gateId },
    include: { requester: { select: { id: true, email: true, nexconnUserId: true } } },
  });
  if (!gate?.parkedAt || (gate.status !== "approved" && gate.status !== "denied")) return;
  const decider = gate.decidedById
    ? await deps.db.user.findUnique({
        where: { id: gate.decidedById },
        select: { id: true, name: true },
      })
    : null;
  const notice = parkedDecisionNotice({
    code: gate.code,
    approved: gate.status === "approved",
    decider: decider ? displayName(decider.name, decider.id) : "a teammate",
    reason: gate.denyReason,
    url: deps.gateUrl(gate.teamId, gate.id),
  });
  await Promise.allSettled([
    systemMessage(deps, gate.requester.nexconnUserId ? [gate.requester.nexconnUserId] : [], notice),
    deps.email({ userId: gate.requester.id, address: gate.requester.email }, notice),
  ]);
}
