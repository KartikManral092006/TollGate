import { connection } from "next/server";
import { revokeHookToken } from "@/features/gates/server/hook-tokens";
import { requireMember } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { checkSameOriginJson } from "@/lib/request-guard";

// The owner, or whoever minted the token, can revoke it.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/tokens/[tokenId]">,
) {
  await connection();
  const guard = checkSameOriginJson(request);
  if (!guard.ok) return json({ error: guard.reason }, guard.status);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, tokenId } = await ctx.params;
  if (!ID_RE.test(tokenId)) return json({ error: "not_found" }, 404);
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;

  if (member.membership.role !== "owner") {
    const own = await db.hookToken.findFirst({
      where: { id: tokenId, createdById: auth.user.id },
      select: { id: true },
    });
    if (!own) return json({ error: "forbidden" }, 403);
  }
  const revoked = await revokeHookToken(db, { tokenId, teamId: id });
  return revoked ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
