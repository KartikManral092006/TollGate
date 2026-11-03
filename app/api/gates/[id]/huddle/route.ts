import { connection } from "next/server";
import { callErrorResponse } from "@/features/call/server/http";
import { requestHuddlePermit } from "@/features/call/server/permits";
import { callPolicy } from "@/features/gates/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { huddleSchema } from "@/features/gates/shared/schemas";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// A permit to start (or the callId to join) the gate's group audio call. The browser only
// calls startCall after this succeeds: billing starts when a call is created.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/huddle">) {
  await connection();
  const auth = await requireWriter(request, { name: "huddle", rule: { window: 600, max: 10 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, huddleSchema);
  if (!body.ok) return body.response;

  try {
    const permit = await requestHuddlePermit(db, {
      gateId: id,
      userId: auth.user.id,
      onlineMemberIds: body.data.onlineMemberIds,
      policy: callPolicy(),
      newId: () => newAlnumId(),
    });
    return json(permit, permit.kind === "start" ? 201 : 200);
  } catch (error) {
    return callErrorResponse(error);
  }
}
