import "server-only";
import type { PrismaClient, TeamAiConfig } from "@/lib/generated/prisma/client";
import type { ProviderConfig } from "@/features/why/server/explain";
import type { AiConfigInput, AiConfigView } from "@/features/why/shared/providers";
import { env } from "@/lib/env";
import { lastFour, openSecret, sealSecret } from "@/lib/crypto-box";
import { assertPublicUrl } from "@/lib/safe-url";

// The server-wide default (operator's Anthropic key) when a team hasn't chosen a provider.
export const DEFAULT_MODEL = "claude-haiku-5-5";

export class AiConfigError extends Error {
  override readonly name = "AiConfigError";

  constructor(readonly reason: "keys_not_configured" | "key_required" | "unsafe_url") {
    super(`AI config rejected: ${reason}`);
  }
}

export function toAiConfigView(row: TeamAiConfig | null): AiConfigView {
  return {
    provider: row?.provider ?? "builtin",
    label: row?.label ?? null,
    baseUrl: row?.baseUrl ?? null,
    model: row?.model ?? null,
    hasKey: Boolean(row?.apiKeySealed),
    keyLast4: row?.apiKeyLast4 ?? null,
    canSaveKeys: Boolean(env.AI_KEYS_SECRET),
  };
}

export function loadAiConfig(db: PrismaClient, teamId: string) {
  return db.teamAiConfig.findUnique({ where: { teamId } });
}

function decryptKey(row: TeamAiConfig): string | null {
  if (!row.apiKeySealed || !env.AI_KEYS_SECRET) return null;
  try {
    return openSecret(row.apiKeySealed, env.AI_KEYS_SECRET);
  } catch {
    return null; // rotated secret or damaged row: treated as no key
  }
}

// The provider "Why?" should use for this team, or null for the built-in explanation.
export function resolveProvider(row: TeamAiConfig | null): ProviderConfig | null {
  if (row && row.provider !== "builtin" && row.model) {
    const apiKey = decryptKey(row);
    if (row.provider === "anthropic" && apiKey) {
      return { provider: "anthropic", model: row.model, apiKey, baseUrl: row.baseUrl };
    }
    if (row.provider === "openai_compatible" && row.baseUrl) {
      return { provider: "openai_compatible", model: row.model, baseUrl: row.baseUrl, apiKey };
    }
  }
  if (row?.provider === "builtin") return null;
  return env.AI_API_KEY
    ? { provider: "anthropic", model: DEFAULT_MODEL, apiKey: env.AI_API_KEY }
    : null;
}

// Builds the provider config from submitted settings, reusing the saved key when the form
// leaves the key field empty (the browser never has it).
export async function providerFromInput(
  input: AiConfigInput,
  saved: TeamAiConfig | null,
): Promise<ProviderConfig | null> {
  if (input.provider === "builtin") return null;
  if (input.baseUrl) {
    try {
      await assertPublicUrl(input.baseUrl);
    } catch {
      throw new AiConfigError("unsafe_url");
    }
  }
  const sameProvider = saved?.provider === input.provider;
  const apiKey =
    input.apiKey !== undefined
      ? input.apiKey || null
      : saved && sameProvider
        ? decryptKey(saved)
        : null;
  if (input.provider === "anthropic") {
    if (!apiKey) throw new AiConfigError("key_required");
    return { provider: "anthropic", model: input.model!, apiKey, baseUrl: input.baseUrl || null };
  }
  return {
    provider: "openai_compatible",
    model: input.model!,
    baseUrl: input.baseUrl!,
    apiKey,
  };
}

export async function saveAiConfig(
  db: PrismaClient,
  input: { teamId: string; userId: string; config: AiConfigInput },
) {
  const { config } = input;
  if (config.baseUrl && config.provider !== "builtin") {
    try {
      await assertPublicUrl(config.baseUrl);
    } catch {
      throw new AiConfigError("unsafe_url");
    }
  }
  let keyFields: { apiKeySealed: string | null; apiKeyLast4: string | null } | object = {};
  if (config.provider === "builtin" || config.apiKey === "") {
    keyFields = { apiKeySealed: null, apiKeyLast4: null };
  } else if (config.apiKey) {
    if (!env.AI_KEYS_SECRET) throw new AiConfigError("keys_not_configured");
    keyFields = {
      apiKeySealed: sealSecret(config.apiKey, env.AI_KEYS_SECRET),
      apiKeyLast4: lastFour(config.apiKey),
    };
  }
  const saved = await db.teamAiConfig.findUnique({ where: { teamId: input.teamId } });
  // A key belongs to one provider: switching without a new key drops the old one rather than
  // sending, say, an Anthropic key to another company's API.
  const switched = saved !== null && saved.provider !== config.provider;
  if (switched && config.apiKey === undefined)
    keyFields = { apiKeySealed: null, apiKeyLast4: null };
  if (config.provider === "anthropic" && !config.apiKey && (switched || !saved?.apiKeySealed)) {
    throw new AiConfigError("key_required");
  }
  const fields = {
    provider: config.provider,
    label: config.label || null,
    baseUrl: config.provider === "builtin" ? null : config.baseUrl || null,
    model: config.provider === "builtin" ? null : config.model || null,
    updatedById: input.userId,
    ...keyFields,
  };
  return db.teamAiConfig.upsert({
    where: { teamId: input.teamId },
    create: { teamId: input.teamId, ...fields },
    update: fields,
  });
}
