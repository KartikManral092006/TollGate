import { connection, type NextRequest } from "next/server";
import { getTeamGate } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { toGateView } from "@/features/gates/shared/view";
import { withInsights } from "@/features/insights/server/insights";
import { requireMember, requireReader } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// One gate with its insights, for the gate page to stay current. Members only; anything else
// is a 404 so gate IDs can't be probed.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/gates/[id]">) {
  await connection();
  const auth = await requireReader(request, { name: "gate", rule: { window: 60, max: 120 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const found = await db.gate.findUnique({ where: { id }, select: { teamId: true } });
  if (!found) return json({ error: "not_found" }, 404);
  const member = await requireMember(found.teamId, auth.user.id);
  if (!member.ok) return member.response;
  const gate = await getTeamGate(db, found.teamId, id);
  if (!gate) return json({ error: "not_found" }, 404);
  const [view] = await withInsights(db, found.teamId, [toGateView(gate)]);
  return json({ gate: view });
}
