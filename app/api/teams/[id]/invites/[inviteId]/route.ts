import { connection } from "next/server";
import { requireMember } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { checkSameOriginJson } from "@/lib/request-guard";

// Owner only: an invite link stops working at once.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/invites/[inviteId]">,
) {
  await connection();
  const guard = checkSameOriginJson(request);
  if (!guard.ok) return json({ error: guard.reason }, guard.status);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, inviteId } = await ctx.params;
  if (!ID_RE.test(inviteId)) return json({ error: "not_found" }, 404);
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;

  const { count } = await db.invite.updateMany({
    where: { id: inviteId, teamId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count === 1 ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
