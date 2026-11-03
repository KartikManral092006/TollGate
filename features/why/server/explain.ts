import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildWhyPrompt,
  tidyExplanation,
  WHY_SYSTEM,
  type WhyInput,
} from "@/features/why/shared/prompt";

// A Haiku-class model, as PLAN.md §14 sets for "Why?": short answers, cheap per gate.
export const WHY_MODEL = "claude-haiku-5-5";

export class WhyUnavailableError extends Error {
  override readonly name = "WhyUnavailableError";

  constructor(readonly reason: "rate_limited" | "failed") {
    super(`Explanation unavailable: ${reason}`);
  }
}

let client: Anthropic | undefined;

function getClient(apiKey: string): Anthropic {
  // One retry and a short timeout: someone is waiting on the card.
  client ??= new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  return client;
}

// Null when the model declines (refusal) or returns nothing usable.
export async function explainCommand(apiKey: string, input: WhyInput): Promise<string | null> {
  try {
    const response = await getClient(apiKey).messages.create({
      model: WHY_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: WHY_SYSTEM,
      messages: [{ role: "user", content: buildWhyPrompt(input) }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return tidyExplanation(text);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new WhyUnavailableError("rate_limited");
    if (error instanceof Anthropic.APIError) throw new WhyUnavailableError("failed");
    throw error;
  }
}
