import { connection, type NextRequest } from "next/server";
import { listTeamGates } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireMember } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json, requireUser } from "@/lib/http";

// The audit log, and the room's way to rebuild card state when history lacks metadata.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/teams/[id]/gates">) {
  await connection();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;

  const cursor = request.nextUrl.searchParams.get("cursor");
  const gates = await listTeamGates(db, id, {
    take: 50,
    cursor: cursor && GATE_ID_RE.test(cursor) ? cursor : undefined,
  });
  return json({ gates, nextCursor: gates.length === 50 ? gates.at(-1)?.id : null });
}
