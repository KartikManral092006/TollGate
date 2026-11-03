import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildWhyPrompt,
  tidyExplanation,
  WHY_SYSTEM,
  type WhyInput,
} from "@/features/why/shared/prompt";
import { assertPublicUrl } from "@/lib/safe-url";

export type ProviderConfig =
  | { provider: "anthropic"; model: string; apiKey: string; baseUrl?: string | null }
  | { provider: "openai_compatible"; model: string; baseUrl: string; apiKey?: string | null };

export class WhyUnavailableError extends Error {
  override readonly name = "WhyUnavailableError";

  constructor(readonly reason: "rate_limited" | "auth" | "bad_request" | "failed") {
    super(`Explanation unavailable: ${reason}`);
  }
}

const TIMEOUT_MS = 20_000;

// Some open models (DeepSeek R1, QwQ…) put their reasoning in <think> tags; approvers only
// need the answer.
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");
}

async function viaAnthropic(
  config: Extract<ProviderConfig, { provider: "anthropic" }>,
  input: WhyInput,
) {
  if (config.baseUrl) await assertPublicUrl(config.baseUrl);
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  });
  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 2000,
      system: WHY_SYSTEM,
      messages: [{ role: "user", content: buildWhyPrompt(input) }],
    });
    if (response.stop_reason === "refusal") return null;
    return response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new WhyUnavailableError("rate_limited");
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      throw new WhyUnavailableError("auth");
    }
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
      throw new WhyUnavailableError("bad_request");
    }
    if (error instanceof Anthropic.APIError) throw new WhyUnavailableError("failed");
    throw error;
  }
}

type ChatCompletion = { choices?: { message?: { content?: unknown } }[] };

async function viaOpenAiCompatible(
  config: Extract<ProviderConfig, { provider: "openai_compatible" }>,
  input: WhyInput,
  fetchImpl: typeof fetch,
) {
  const base = await assertPublicUrl(config.baseUrl);
  const url = new URL(`${base.pathname.replace(/\/+$/, "")}/chat/completions`, base.origin);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      redirect: "error", // a redirect could point the request at an internal address
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 600,
        messages: [
          { role: "system", content: WHY_SYSTEM },
          { role: "user", content: buildWhyPrompt(input) },
        ],
      }),
    });
  } catch {
    throw new WhyUnavailableError("failed");
  }
  if (response.status === 429) throw new WhyUnavailableError("rate_limited");
  if (response.status === 401 || response.status === 403) throw new WhyUnavailableError("auth");
  if (response.status === 400 || response.status === 404 || response.status === 422) {
    throw new WhyUnavailableError("bad_request");
  }
  if (!response.ok) throw new WhyUnavailableError("failed");
  const body = (await response.json().catch(() => null)) as ChatCompletion | null;
  const content = body?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

// Null when the model declines or returns nothing usable.
export async function explainWith(
  config: ProviderConfig,
  input: WhyInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const raw =
    config.provider === "anthropic"
      ? await viaAnthropic(config, input)
      : await viaOpenAiCompatible(config, input, fetchImpl);
  return raw ? tidyExplanation(stripReasoning(raw)) : null;
}
