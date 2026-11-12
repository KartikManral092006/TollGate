import { connection } from "next/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { explainGate } from "@/features/why/server/explain-gate";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Explains a gate's command for the person asking (features/why/server/explain-gate.ts).
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/why">) {
  await connection();
  const auth = await requireWriter(request, { name: "why", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);

  const gate = await db.gate.findUnique({
    where: { id },
    include: { repo: { select: { name: true } } },
  });
  if (!gate) return json({ error: "not_found" }, 404);
  const member = await requireMember(gate.teamId, auth.user.id);
  if (!member.ok) return member.response;

  return json(await explainGate(db, gate));
}
