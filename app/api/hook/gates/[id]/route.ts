import { connection } from "next/server";
import { gateUrl } from "@/features/gates/server";
import { getGateForRepo } from "@/features/gates/server/gates";
import { requireHook } from "@/features/gates/server/hook-http";
import { GATE_ID_RE, type HookGateStatus } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Polled about once a second by a waiting hook. A gate from another repo is a 404.
export async function GET(request: Request, ctx: RouteContext<"/api/hook/gates/[id]">) {
  await connection();
  const auth = await requireHook(request, { name: "poll", rule: { window: 60, max: 240 } });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);
  const found = await getGateForRepo(db, id, auth.principal.repoId);
  if (!found) return json({ error: "not_found" }, 404);

  const { gate } = found;
  const body: HookGateStatus = {
    id: gate.id,
    code: gate.code,
    status: gate.status,
    quorum: gate.quorum,
    approvals: found.approvals,
    denyReason: gate.denyReason,
    decidedBy: found.decidedByName,
    mode: auth.principal.mode,
    url: gateUrl(gate.teamId, gate.id),
  };
  return json(body);
}
