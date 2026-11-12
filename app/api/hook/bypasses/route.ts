import { connection } from "next/server";
import { announceBypass, gateUrl } from "@/features/gates/server";
import { recordBypass } from "@/features/gates/server/bypasses";
import { requireHook, requireJsonContent } from "@/features/gates/server/hook-http";
import { reportBypassSchema } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { readJsonBody, TOO_LARGE } from "@/lib/request-guard";

// The hook reports a call that went through with TOLLGATE_BYPASS=1 (CLI 0.3+). It becomes a
// "bypassed" gate in the room, and approvers are told. Retried reports are recorded once.
export async function POST(request: Request) {
  await connection();
  const wrongType = requireJsonContent(request);
  if (wrongType) return wrongType;
  const auth = await requireHook(request, { name: "bypass", rule: { window: 3600, max: 120 } });
  if (!auth.ok) return auth.response;

  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return json({ error: "body_too_large" }, 413);
  const parsed = reportBypassSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const recorded = await recordBypass(db, auth.principal, parsed.data);
  if (!recorded) return json({ error: "conflict" }, 409);
  if (recorded.created) {
    logger.warn(
      { teamId: recorded.gate.teamId, gateId: recorded.gate.id, repo: auth.principal.repoName },
      "gate bypassed",
    );
    announceBypass(recorded.gate.id);
  }
  return json(
    {
      ok: true,
      code: recorded.gate.code,
      url: gateUrl(recorded.gate.teamId, recorded.gate.id),
    },
    recorded.created ? 201 : 200,
  );
}
