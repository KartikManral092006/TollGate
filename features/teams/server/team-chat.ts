import type { PrismaClient, Team } from "@/lib/generated/prisma/client";
import type { NexconnClient } from "@/features/nexconn/server/client";
import { createGroup, isCode, joinGroup } from "@/features/nexconn/server/api";
import { NexconnCode } from "@/features/nexconn/shared/codes";
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from "@/features/nexconn/shared/config";

export class ChatUnavailableError extends Error {
  override readonly name = "ChatUnavailableError";

  constructor(readonly reason: "group_quota" | "busy") {
    super(`Team chat unavailable: ${reason}`);
  }
}

export type TeamChatDeps = {
  db: PrismaClient;
  client: NexconnClient;
  // Issues (and caches) an access token, which is how Nexconn registers a user.
  registerUser: (user: { userId: string; name: string }) => Promise<unknown>;
  // Waits between checks while another request is creating the room's group.
  sleep?: (ms: number) => Promise<void>;
  // Per-user budget first, then the global one; both deny when Redis is down.
  allowGroupCreate: (userId: string) => Promise<boolean>;
  // One group create per team at a time, so parallel requests spend one quota unit.
  acquireGroupLock: (teamId: string) => Promise<boolean>;
  releaseGroupLock: (teamId: string) => Promise<void>;
};

export class NotTeamMemberError extends Error {
  override readonly name = "NotTeamMemberError";
}

export type TeamChatResult = { chat: "ok"; channelId: string } | { chat: "full" };

const GROUP_WAIT_MS = 4000;
const GROUP_WAIT_STEP_MS = 250;

// Called when a member opens the room (and by the gate service before the bot posts a card),
// never on a signed-out page view. Teams work from Postgres alone; the Nexconn group is
// created lazily. Every step is idempotent. Membership is never created here: teams are
// invite-only (features/teams/server/teams.ts).
export async function ensureTeamChat(
  deps: TeamChatDeps,
  team: Pick<Team, "id" | "name" | "nexconnChannelId" | "nexconnGroupReadyAt">,
  user: { id: string; nexconnUserId: string; name: string },
): Promise<TeamChatResult> {
  const membership = await deps.db.membership.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
    select: { nexconnJoinedAt: true },
  });
  if (!membership) throw new NotTeamMemberError("Not a member of this team");
  if (membership.nexconnJoinedAt) return { chat: "ok", channelId: team.nexconnChannelId };

  // Token before join: joining a never-registered user is undocumented.
  await deps.registerUser({ userId: user.nexconnUserId, name: user.name });

  const groupRecorded = async () =>
    (
      await deps.db.team.findUnique({
        where: { id: team.id },
        select: { nexconnGroupReadyAt: true },
      })
    )?.nexconnGroupReadyAt != null;

  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  // Someone else holds the team's lock (e.g. two people opened a new team together): wait a
  // little for them to finish creating the group instead of failing at once.
  const waitForOtherCreator = async () => {
    for (let waited = 0; waited < GROUP_WAIT_MS; waited += GROUP_WAIT_STEP_MS) {
      await sleep(GROUP_WAIT_STEP_MS);
      if (await groupRecorded()) return true;
      if (await deps.acquireGroupLock(team.id)) {
        await deps.releaseGroupLock(team.id);
        return false;
      }
    }
    return false;
  };

  // `recreate` skips the "already recorded" shortcut: used when Nexconn says the group is gone.
  const ensureGroup = async (recreate: boolean) => {
    if (!(await deps.acquireGroupLock(team.id))) {
      if (!recreate && (await groupRecorded())) return;
      if (!recreate && (await waitForOtherCreator())) return;
      if (!(await deps.acquireGroupLock(team.id))) throw new ChatUnavailableError("busy");
    }
    try {
      if (!recreate && (await groupRecorded())) return;
      if (!(await deps.allowGroupCreate(user.id))) throw new ChatUnavailableError("group_quota");
      await deps.registerUser({ userId: SYSTEM_USER_ID, name: SYSTEM_USER_NAME });
      await createGroup(deps.client, {
        channelId: team.nexconnChannelId,
        name: team.name.slice(0, 64),
        owner: SYSTEM_USER_ID,
      });
      await deps.db.team.updateMany({
        where: { id: team.id },
        data: { nexconnGroupReadyAt: new Date() },
      });
    } finally {
      await deps.releaseGroupLock(team.id);
    }
  };

  if (!team.nexconnGroupReadyAt) await ensureGroup(false);

  const join = () =>
    joinGroup(deps.client, { channelId: team.nexconnChannelId, userIds: [user.nexconnUserId] });
  try {
    await join();
  } catch (error) {
    if (isCode(error, NexconnCode.GroupFull)) return { chat: "full" };
    if (!isCode(error, NexconnCode.GroupMissing)) throw error;
    // The group was dismissed or never created although we recorded it: create it again once.
    await ensureGroup(true);
    try {
      await join();
    } catch (retryError) {
      if (isCode(retryError, NexconnCode.GroupFull)) return { chat: "full" };
      throw retryError;
    }
  }

  await deps.db.membership.update({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
    data: { nexconnJoinedAt: new Date() },
  });
  return { chat: "ok", channelId: team.nexconnChannelId };
}
