import { connection } from "next/server";
import { ruleSuggestionSchema } from "@/features/gates/shared/schemas";
import { acceptSuggestion, dismissSuggestion } from "@/features/insights/server/policy";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// Owner only: accept a suggested team rule, or dismiss it so it isn't offered again.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/rules">) {
  await connection();
  const auth = await requireWriter(request, { name: "rules", rule: { window: 60, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, ruleSuggestionSchema);
  if (!body.ok) return body.response;

  if (body.data.dismiss) {
    const done = await dismissSuggestion(db, { teamId: id, ...body.data });
    return done ? json({ ok: true }) : json({ error: "not_found" }, 404);
  }
  const ruleId = await acceptSuggestion(db, {
    teamId: id,
    repoId: body.data.repoId,
    key: body.data.key,
    userId: auth.user.id,
    newId: () => newAlnumId(),
  });
  // Not (or no longer) suggested: history changed, or it was never allowed.
  return ruleId ? json({ id: ruleId }, 201) : json({ error: "not_suggested" }, 409);
}
