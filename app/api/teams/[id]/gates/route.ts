import { after, connection, type NextRequest } from "next/server";
import { listTeamGates } from "@/features/gates/server/gates";
import { maybeSweep } from "@/features/gates/server/sweep";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { toGateView } from "@/features/gates/shared/view";
import { withInsights } from "@/features/insights/server/insights";
import { requireMember, requireReader } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// The audit log, and the room's way to rebuild card state when history lacks metadata.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/teams/[id]/gates">) {
  await connection();
  const auth = await requireReader(request, { name: "gates", rule: { window: 60, max: 120 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  after(() => maybeSweep());

  const cursor = request.nextUrl.searchParams.get("cursor");
  const gates = await listTeamGates(db, id, {
    take: 50,
    cursor: cursor && GATE_ID_RE.test(cursor) ? cursor : undefined,
  });
  return json({
    gates: await withInsights(db, id, gates.map(toGateView)),
    nextCursor: gates.length === 50 ? gates.at(-1)?.id : null,
  });
}
