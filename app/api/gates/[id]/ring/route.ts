import { connection } from "next/server";
import { callErrorResponse } from "@/features/call/server/http";
import { requestRingPermit } from "@/features/call/server/permits";
import { callPolicy } from "@/features/gates/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { ringSchema } from "@/features/gates/shared/schemas";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json, rateLimited } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";
import { consumeRate } from "@/lib/rate-limit.server";

// "Ring Ana" about one gate: a 1:1 audio call. At most 3 rings per gate per hour.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/ring">) {
  await connection();
  const auth = await requireWriter(request, { name: "ring", rule: { window: 600, max: 10 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, ringSchema);
  if (!body.ok) return body.response;

  const perGate = await consumeRate(`ring:gate:${id}`, { window: 3600, max: 3 });
  if (!perGate.allowed) return rateLimited(perGate);

  try {
    const permit = await requestRingPermit(db, {
      gateId: id,
      userId: auth.user.id,
      calleeUserId: body.data.userId,
      policy: callPolicy(),
      newId: () => newAlnumId(),
    });
    return json(permit, 201);
  } catch (error) {
    return callErrorResponse(error);
  }
}
