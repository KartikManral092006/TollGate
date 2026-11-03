import { connection } from "next/server";
import { announceGate, gateUrl } from "@/features/gates/server";
import { createGate } from "@/features/gates/server/gates";
import { requireHook, requireJsonContent } from "@/features/gates/server/hook-http";
import { createGateSchema, type HookGateStatus } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";
import { readJsonBody, TOO_LARGE } from "@/lib/request-guard";

// The hook raises a gate. The server re-redacts, applies its own presets and quorum, writes
// the row, and the bot posts the card after the response.
export async function POST(request: Request) {
  await connection();
  const wrongType = requireJsonContent(request);
  if (wrongType) return wrongType;
  const auth = await requireHook(request, { name: "create", rule: { window: 3600, max: 120 } });
  if (!auth.ok) return auth.response;

  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return json({ error: "body_too_large" }, 413);
  const parsed = createGateSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const gate = await createGate(db, auth.principal, parsed.data, { newId: () => newAlnumId() });
  announceGate(gate.id);

  const body: HookGateStatus = {
    id: gate.id,
    code: gate.code,
    status: gate.status,
    quorum: gate.quorum,
    approvals: 0,
    denyReason: null,
    question: null,
    decidedBy: null,
    mode: auth.principal.mode,
    url: gateUrl(gate.teamId, gate.id),
  };
  return json(body, 201);
}
