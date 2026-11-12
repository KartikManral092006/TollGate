import { after, connection } from "next/server";
import { getNexconn } from "@/features/nexconn/server";
import { dismissGroup } from "@/features/nexconn/server/api";
import { deleteTeam, DeleteTeamError } from "@/features/teams/server/delete-team";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { deleteTeamSchema } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

const ERRORS: Record<DeleteTeamError["reason"], [number, string]> = {
  not_found: [404, "not_found"],
  not_owner: [403, "forbidden"],
  wrong_name: [400, "wrong_name"],
};

// Owner only, with the team's name typed to confirm: deletes the team and everything in it
// (features/teams/server/delete-team.ts). Postgres is the truth; the chat group is dismissed
// after the response, so a Nexconn outage never blocks a delete.
export async function DELETE(request: Request, ctx: RouteContext<"/api/teams/[id]">) {
  await connection();
  const auth = await requireWriter(request, {
    name: "team-delete",
    rule: { window: 3600, max: 10 },
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, deleteTeamSchema);
  if (!body.ok) return body.response;

  let deleted;
  try {
    deleted = await deleteTeam(db, {
      teamId: id,
      actorId: auth.user.id,
      confirmName: body.data.name,
    });
  } catch (error) {
    if (error instanceof DeleteTeamError) {
      const [status, code] = ERRORS[error.reason];
      return json({ error: code }, status);
    }
    throw error;
  }
  logger.info(
    {
      teamId: id,
      by: auth.user.id,
      repos: deleted.repos,
      gates: deleted.gates,
      members: deleted.members,
    },
    "team deleted",
  );

  if (deleted.hadChatGroup) {
    after(async () => {
      try {
        await dismissGroup(getNexconn(), { channelId: deleted.nexconnChannelId });
      } catch (error) {
        logger.warn({ err: error, teamId: id }, "deleted team's chat group is still there");
      }
    });
  }

  return json({ ok: true, name: deleted.name });
}
