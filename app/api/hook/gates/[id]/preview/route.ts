import { connection } from "next/server";
import { mirrorGate } from "@/features/gates/server";
import { requireHook, requireJsonContent } from "@/features/gates/server/hook-http";
import { attachPreviewSchema, GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { redact, truncate } from "@/features/gates/shared/redact";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { readJsonBody, TOO_LARGE } from "@/lib/request-guard";

// The hook's read-only impact preview for a gate it just raised (CLI 0.3+), posted while the
// team already looks at the card. Once per gate, this repo's own gates only.
export async function POST(request: Request, ctx: RouteContext<"/api/hook/gates/[id]/preview">) {
  await connection();
  const wrongType = requireJsonContent(request);
  if (wrongType) return wrongType;
  const auth = await requireHook(request, { name: "preview", rule: { window: 3600, max: 120 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);

  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return json({ error: "body_too_large" }, 413);
  const parsed = attachPreviewSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_body" }, 400);

  const preview = redact(parsed.data.preview);
  const { count } = await db.gate.updateMany({
    where: { id, repoId: auth.principal.repoId, preview: null },
    data: { preview: truncate(preview.text, 2000), redactions: { increment: preview.count } },
  });
  // The card's metadata changes, so every open room refetches and shows it.
  if (count === 1) mirrorGate(id);
  return json({ ok: true, attached: count === 1 });
}
