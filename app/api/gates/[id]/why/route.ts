import { connection } from "next/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { loadAiConfig, resolveProvider } from "@/features/why/server/config";
import { explainWith, WhyUnavailableError } from "@/features/why/server/explain";
import { builtinExplanation } from "@/features/why/shared/builtin";
import type { WhyResult } from "@/features/why/shared/providers";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { toolOf } from "@/features/gates/shared/view";

const CACHE_SECONDS = 7 * 86_400;

// The team's own AI provider if it set one, else the server default, else the built-in
// rule-based explanation. A failing provider falls back to built-in instead of an error.
// AI answers are cached per gate and provider, so a team asking costs one call.
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

  const input = {
    command: gate.command,
    // What a package script really runs is the part worth explaining.
    context: gate.via ? `Runs:\n${gate.via}\n\n${gate.context}` : gate.context,
    intent: gate.intent,
    preset: gate.preset,
    env: gate.env,
    repo: gate.repo.name,
    tool: toolOf(gate.tool),
  };
  const builtin = (fallback: boolean): WhyResult => ({
    text: builtinExplanation(input),
    source: "builtin",
    model: null,
    fallback,
  });

  const provider = resolveProvider(await loadAiConfig(db, gate.teamId));
  if (!provider) return json(builtin(false));

  const generation = (await redis.get(`why:gen:${gate.teamId}`).catch(() => null)) ?? "0";
  const key = `why:v2:${gate.id}:${generation}:${provider.provider}:${provider.model}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return json({ text: cached, source: "ai", model: provider.model, fallback: false });

  try {
    const text = await explainWith(provider, input);
    if (!text) return json(builtin(true));
    await redis.set(key, text, "EX", CACHE_SECONDS).catch(() => undefined);
    const result: WhyResult = { text, source: "ai", model: provider.model, fallback: false };
    return json(result);
  } catch (error) {
    if (error instanceof WhyUnavailableError) {
      logger.warn({ reason: error.reason, gateId: id, provider: provider.provider }, "why failed");
      return json(builtin(true));
    }
    logger.warn({ err: error, gateId: id }, "why provider error");
    return json(builtin(true));
  }
}
