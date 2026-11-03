import { connection } from "next/server";
import { markCallJoined, markCallLive } from "@/features/call/server/permits";
import { announceHuddle, mirrorHuddle } from "@/features/gates/server";
import { callJoinedSchema } from "@/features/gates/shared/schemas";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// With callId: the starter reports that startCall succeeded (the call becomes live and the
// bot posts the TG:Huddle card). Without: another member joined the live call.
export async function POST(request: Request, ctx: RouteContext<"/api/calls/[id]/joined">) {
  await connection();
  const auth = await requireWriter(request, { name: "calljoin", rule: { window: 600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, callJoinedSchema);
  if (!body.ok) return body.response;

  if (body.data.callId) {
    const call = await markCallLive(db, {
      permitId: id,
      userId: auth.user.id,
      callId: body.data.callId,
    });
    if (!call) return json({ error: "not_found" }, 404);
    announceHuddle(call.id);
    return json({ status: call.status });
  }
  const call = await markCallJoined(db, { permitId: id, userId: auth.user.id });
  if (!call) return json({ error: "not_found" }, 404);
  mirrorHuddle(call.id);
  return json({ status: call.status, participants: call.participants.length });
}
