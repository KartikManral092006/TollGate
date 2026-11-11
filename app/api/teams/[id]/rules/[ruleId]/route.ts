import { connection } from "next/server";
import { removeRule } from "@/features/insights/server/policy";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Owner only: the next matching gate waits for people again.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/rules/[ruleId]">,
) {
  await connection();
  const auth = await requireWriter(request, { name: "rule-delete", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id, ruleId } = await ctx.params;
  if (!ID_RE.test(ruleId)) return json({ error: "not_found" }, 404);
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;

  return (await removeRule(db, { teamId: id, ruleId }))
    ? json({ ok: true })
    : json({ error: "not_found" }, 404);
}
