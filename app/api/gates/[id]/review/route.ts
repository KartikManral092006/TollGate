import { connection } from "next/server";
import { z } from "zod";
import { mirrorGate } from "@/features/gates/server";
import { reviewBypass, ReviewRejectedError } from "@/features/gates/server/bypasses";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

const reviewSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

const STATUS_FOR: Record<ReviewRejectedError["reason"], number> = {
  not_found: 404,
  not_bypassed: 409,
  own_gate: 403,
  not_allowed: 403,
};

// A teammate has looked at what a bypassed call did. Anyone who can vote, except the person
// whose agent ran it.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/review">) {
  await connection();
  const auth = await requireWriter(request, { name: "review", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, reviewSchema);
  if (!body.ok) return body.response;

  try {
    const result = await reviewBypass(db, {
      gateId: id,
      userId: auth.user.id,
      note: body.data.note,
    });
    if (result.reviewedNow) mirrorGate(id);
    return json({ ok: true, reviewedNow: result.reviewedNow });
  } catch (error) {
    if (error instanceof ReviewRejectedError) {
      return json({ error: error.reason }, STATUS_FOR[error.reason]);
    }
    throw error;
  }
}
