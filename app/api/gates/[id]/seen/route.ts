import { connection } from "next/server";
import { mirrorGate } from "@/features/gates/server";
import { markGateSeen } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// The viewer's room had this waiting card on screen. Recorded once per person; the first
// time, the card's metadata changes so "Seen by" updates in everyone's room.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/seen">) {
  await connection();
  const auth = await requireWriter(request, { name: "seen", rule: { window: 60, max: 60 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const first = await markGateSeen(db, { gateId: id, userId: auth.user.id });
  if (first) mirrorGate(id);
  return json({ first });
}
