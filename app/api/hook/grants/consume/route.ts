import { connection } from "next/server";
import { consumeGrant } from "@/features/gates/server/gates";
import { requireHook, requireJsonContent } from "@/features/gates/server/hook-http";
import { consumeGrantSchema } from "@/features/gates/shared/hook-api";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { readJsonBody, TOO_LARGE } from "@/lib/request-guard";

// Single use and bound to the exact command, directory and repo (cmdHash).
export async function POST(request: Request) {
  await connection();
  const wrongType = requireJsonContent(request);
  if (wrongType) return wrongType;
  const auth = await requireHook(request, { name: "grant", rule: { window: 3600, max: 600 } });
  if (!auth.ok) return auth.response;

  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return json({ error: "body_too_large" }, 413);
  const parsed = consumeGrantSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const grant = await consumeGrant(db, {
    repoId: auth.principal.repoId,
    cmdHash: parsed.data.cmdHash,
  });
  return json(
    grant ? { ok: true, gateId: grant.gateId, mode: auth.principal.mode } : { ok: false },
  );
}
