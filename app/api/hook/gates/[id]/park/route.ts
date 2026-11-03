import { connection } from "next/server";
import { parkGate } from "@/features/gates/server/gates";
import { announceParked, mirrorGate } from "@/features/gates/server";
import { requireHook } from "@/features/gates/server/hook-http";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// The hook gives up waiting before its own timeout and parks the gate. Approving it later
// issues a single-use grant the agent's retry can redeem.
export async function POST(request: Request, ctx: RouteContext<"/api/hook/gates/[id]/park">) {
  await connection();
  const auth = await requireHook(request, { name: "park", rule: { window: 3600, max: 120 } });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const result = await parkGate(db, { gateId: id, repoId: auth.principal.repoId });
  if (!result) return json({ error: "not_found" }, 404);
  if (result.status === "parked") mirrorGate(id);
  if (result.parkedNow) announceParked(id);
  return json({ status: result.status });
}
