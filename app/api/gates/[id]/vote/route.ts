import { connection } from "next/server";
import { announceParkedDecision, mirrorGate } from "@/features/gates/server";
import { castVote, VoteRejectedError } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { voteSchema } from "@/features/gates/shared/schemas";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

const STATUS_FOR: Record<VoteRejectedError["reason"], number> = {
  not_found: 404,
  closed: 409,
  voted: 409,
  not_waiting: 409,
  own_gate: 403,
  not_allowed: 403,
};

export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/vote">) {
  await connection();
  const auth = await requireWriter(request, { name: "vote", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const body = await readBody(request, voteSchema);
  if (!body.ok) return body.response;

  try {
    const outcome = await castVote(db, {
      gateId: id,
      userId: auth.user.id,
      decision: body.data.decision,
      reason: body.data.reason,
      newId: () => newAlnumId(),
    });
    mirrorGate(id);
    const decided =
      outcome.evaluation.status === "approved" || outcome.evaluation.status === "denied";
    if (decided && outcome.previous === "parked") announceParkedDecision(id);
    return json({
      status: outcome.evaluation.status,
      approvals: outcome.evaluation.approvals,
      quorum: outcome.quorum,
      grantExpiresAt: outcome.grantExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof VoteRejectedError) {
      return json({ error: error.reason }, STATUS_FOR[error.reason]);
    }
    throw error;
  }
}
