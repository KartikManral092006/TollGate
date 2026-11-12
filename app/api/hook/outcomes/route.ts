import { connection } from "next/server";
import { mirrorGate } from "@/features/gates/server";
import { requireHook, requireJsonContent } from "@/features/gates/server/hook-http";
import { recordOutcome } from "@/features/gates/server/outcomes";
import { reportOutcomeSchema } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { readJsonBody, TOO_LARGE } from "@/lib/request-guard";

// The hook reports what happened when an approved call ran (CLI 0.3+). Only ever attaches to
// this repo's own approved gates; anything else is accepted and ignored, so the hook (which
// runs in the background and never retries) has nothing to handle.
export async function POST(request: Request) {
  await connection();
  const wrongType = requireJsonContent(request);
  if (wrongType) return wrongType;
  const auth = await requireHook(request, { name: "outcome", rule: { window: 3600, max: 600 } });
  if (!auth.ok) return auth.response;

  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return json({ error: "body_too_large" }, 413);
  const parsed = reportOutcomeSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const gateId = await recordOutcome(db, { repoId: auth.principal.repoId, report: parsed.data });
  // The card's metadata changes, so every open room refetches and shows the result.
  if (gateId) mirrorGate(gateId);
  return json({ ok: true, recorded: gateId !== null });
}
