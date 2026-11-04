import { connection } from "next/server";
import { mirrorGate } from "@/features/gates/server";
import { endWindow } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Close an approval window before its time: the agent's next gate of that kind asks again.
export async function POST(request: Request, ctx: RouteContext<"/api/windows/[id]/end">) {
  await connection();
  const auth = await requireWriter(request, { name: "window-end", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);

  const ended = await endWindow(db, { windowId: id, userId: auth.user.id });
  if (!ended) return json({ error: "not_found" }, 404);
  mirrorGate(ended.gateId);
  return json({ ended: true });
}
