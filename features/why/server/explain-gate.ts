import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { toolOf } from "@/features/gates/shared/view";
import { loadAiConfig, resolveProvider } from "@/features/why/server/config";
import { explainWith, WhyUnavailableError } from "@/features/why/server/explain";
import { builtinExplanation } from "@/features/why/shared/builtin";
import type { WhyResult } from "@/features/why/shared/providers";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const CACHE_SECONDS = 7 * 86_400;

type GateForWhy = {
  id: string;
  teamId: string;
  command: string;
  context: string;
  via: string | null;
  intent: string | null;
  preset: string;
  env: string;
  tool: string;
  repo: { name: string };
};

// The team's own AI provider if it set one, else the server default, else the built-in
// rule-based explanation. A failing provider falls back to built-in instead of an error.
// AI answers are cached per gate and provider, so a team asking costs one call.
export async function explainGate(db: PrismaClient, gate: GateForWhy): Promise<WhyResult> {
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
  if (!provider) return builtin(false);

  const generation = (await redis.get(`why:gen:${gate.teamId}`).catch(() => null)) ?? "0";
  const key = `why:v2:${gate.id}:${generation}:${provider.provider}:${provider.model}`;
  const cached = await redis.get(key).catch(() => null);
  if (cached) return { text: cached, source: "ai", model: provider.model, fallback: false };

  try {
    const text = await explainWith(provider, input);
    if (!text) return builtin(true);
    await redis.set(key, text, "EX", CACHE_SECONDS).catch(() => undefined);
    return { text, source: "ai", model: provider.model, fallback: false };
  } catch (error) {
    if (error instanceof WhyUnavailableError) {
      logger.warn(
        { reason: error.reason, gateId: gate.id, provider: provider.provider },
        "why failed",
      );
      return builtin(true);
    }
    logger.warn({ err: error, gateId: gate.id }, "why provider error");
    return builtin(true);
  }
}
