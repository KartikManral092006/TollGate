import { connection } from "next/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { createGateInvite } from "@/features/teams/server/teams";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// Owner only, like every invite. A link for one person to join and decide this gate; it is
// returned once and only its hash is stored.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/invite">) {
  await connection();
  const auth = await requireWriter(request, { name: "invite", rule: { window: 3600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const gate = await db.gate.findUnique({ where: { id }, select: { teamId: true } });
  if (!gate) return json({ error: "not_found" }, 404);
  const member = await requireMember(gate.teamId, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;

  const result = await createGateInvite(db, {
    id: newAlnumId(),
    teamId: gate.teamId,
    gateId: id,
    createdById: auth.user.id,
  });
  if (!result.ok) {
    return json({ error: result.reason }, result.reason === "not_found" ? 404 : 409);
  }
  return json(
    {
      url: new URL(`/invite/${result.token}`, env.NEXT_PUBLIC_APP_URL).toString(),
      expiresAt: result.expiresAt.toISOString(),
    },
    201,
  );
}
