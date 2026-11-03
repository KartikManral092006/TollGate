import { connection } from "next/server";
import { markCallEnded } from "@/features/call/server/permits";
import { mirrorHuddle } from "@/features/gates/server";
import { callEndedSchema } from "@/features/gates/shared/schemas";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

export async function POST(request: Request, ctx: RouteContext<"/api/calls/[id]/ended">) {
  await connection();
  const auth = await requireWriter(request, { name: "callend", rule: { window: 600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, callEndedSchema);
  if (!body.ok) return body.response;

  const call = await markCallEnded(db, {
    permitId: id,
    userId: auth.user.id,
    durationSec: body.data.durationSec,
  });
  if (call) mirrorHuddle(call.id);
  // Already ended by another participant (or the sweeper) is fine for the caller.
  return json({ status: call?.status ?? "ended" });
}
