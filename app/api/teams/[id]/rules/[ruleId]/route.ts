import { connection } from "next/server";
import { removeRule } from "@/features/insights/server/policy";
import { requireMember } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { checkSameOriginJson } from "@/lib/request-guard";

// Owner only: the next matching gate waits for people again.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/rules/[ruleId]">,
) {
  await connection();
  const guard = checkSameOriginJson(request);
  if (!guard.ok) return json({ error: guard.reason }, guard.status);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, ruleId } = await ctx.params;
  if (!ID_RE.test(ruleId)) return json({ error: "not_found" }, 404);
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;

  return (await removeRule(db, { teamId: id, ruleId }))
    ? json({ ok: true })
    : json({ error: "not_found" }, 404);
}
