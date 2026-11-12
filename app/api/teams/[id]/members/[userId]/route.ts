import { after, connection } from "next/server";
import { getNexconn } from "@/features/nexconn/server";
import { leaveGroup } from "@/features/nexconn/server/api";
import { removeMember, RemoveMemberError } from "@/features/teams/server/members";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

const ERRORS: Record<RemoveMemberError["reason"], [number, string]> = {
  not_owner: [403, "forbidden"],
  not_member: [404, "not_found"],
  self: [400, "cannot_remove_self"],
  owner: [400, "cannot_remove_owner"],
};

// Owner only: removes someone from the team and switches off everything they could still use
// (features/teams/server/members.ts). Postgres is the truth; leaving the Nexconn group runs
// after the response, so a Nexconn outage never blocks a removal.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/members/[userId]">,
) {
  await connection();
  const auth = await requireWriter(request, {
    name: "member-remove",
    rule: { window: 600, max: 30 },
  });
  if (!auth.ok) return auth.response;
  const { id, userId } = await ctx.params;
  if (!ID_RE.test(userId)) return json({ error: "not_found" }, 404);
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;

  let removed;
  try {
    removed = await removeMember(db, { teamId: id, actorId: auth.user.id, userId });
  } catch (error) {
    if (error instanceof RemoveMemberError) {
      const [status, code] = ERRORS[error.reason];
      return json({ error: code }, status);
    }
    throw error;
  }
  logger.info({ teamId: id, by: auth.user.id, ...removed }, "member removed");

  const team = member.membership.team;
  const nexconnUserId = removed.nexconnUserId;
  if (team.nexconnGroupReadyAt && nexconnUserId) {
    after(async () => {
      try {
        await leaveGroup(getNexconn(), {
          channelId: team.nexconnChannelId,
          userIds: [nexconnUserId],
        });
      } catch (error) {
        logger.warn(
          { err: error, teamId: id, userId },
          "removed member is still in the chat group",
        );
      }
    });
  }

  return json({
    ok: true,
    tokens: removed.tokens,
    windows: removed.windows,
    votes: removed.votes,
    gates: removed.gates,
    invites: removed.invites,
  });
}
