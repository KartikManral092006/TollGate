import { after, connection } from "next/server";
import { getNexconn } from "@/features/nexconn/server";
import { leaveGroup } from "@/features/nexconn/server/api";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { leaveTeam, LeaveTeamError } from "@/features/teams/server/members";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

// Anyone but an owner takes themselves out of a team, with the same switch-offs as being
// removed (features/teams/server/members.ts). Leaving the chat group runs after the response.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/leave">) {
  await connection();
  const auth = await requireWriter(request, {
    name: "team-leave",
    rule: { window: 3600, max: 20 },
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;

  let left;
  try {
    left = await leaveTeam(db, { teamId: id, userId: auth.user.id });
  } catch (error) {
    if (error instanceof LeaveTeamError) {
      return error.reason === "owner"
        ? json({ error: "owner_cannot_leave" }, 400)
        : json({ error: "not_found" }, 404);
    }
    throw error;
  }
  logger.info({ teamId: id, ...left }, "member left");

  const team = member.membership.team;
  const nexconnUserId = left.nexconnUserId;
  if (team.nexconnGroupReadyAt && nexconnUserId) {
    after(async () => {
      try {
        await leaveGroup(getNexconn(), {
          channelId: team.nexconnChannelId,
          userIds: [nexconnUserId],
        });
      } catch (error) {
        logger.warn({ err: error, teamId: id }, "member who left is still in the chat group");
      }
    });
  }

  return json({ ok: true });
}
