import { connection } from "next/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { explainCommand, WhyUnavailableError } from "@/features/why/server/explain";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const CACHE_SECONDS = 7 * 86_400;

// One explanation per gate, cached: a whole team asking "Why?" costs a single model call.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/why">) {
  await connection();
  const auth = await requireWriter(request, { name: "why", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);

  const gate = await db.gate.findUnique({
    where: { id },
    include: { repo: { select: { name: true } } },
  });
  if (!gate) return json({ error: "not_found" }, 404);
  const member = await requireMember(gate.teamId, auth.user.id);
  if (!member.ok) return member.response;
  if (!env.AI_API_KEY) return json({ error: "why_unavailable" }, 503);

  const key = `why:v1:${gate.id}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return json({ text: cached, cached: true });

  try {
    const text = await explainCommand(env.AI_API_KEY, {
      command: gate.command,
      context: gate.context,
      preset: gate.preset,
      env: gate.env,
      repo: gate.repo.name,
    });
    if (!text) return json({ error: "no_explanation" }, 422);
    await redis.set(key, text, "EX", CACHE_SECONDS).catch(() => undefined);
    return json({ text, cached: false });
  } catch (error) {
    if (error instanceof WhyUnavailableError) {
      logger.warn({ reason: error.reason, gateId: id }, "why failed");
      return json({ error: error.reason }, error.reason === "rate_limited" ? 429 : 502);
    }
    throw error;
  }
}
