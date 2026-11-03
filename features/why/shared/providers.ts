import { z } from "zod";

// Presets for Settings › AI explanations. Base URLs are starting points the owner can edit;
// every provider's own docs are the authority. "openai_compatible" covers any server that
// speaks the OpenAI chat-completions API.

export type ProviderKind = "builtin" | "anthropic" | "openai_compatible";

export type ProviderPreset = {
  id: string;
  label: string;
  provider: ProviderKind;
  baseUrl: string;
  modelHint: string;
  keyRequired: boolean;
  note?: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "builtin",
    label: "Built-in (free, no AI)",
    provider: "builtin",
    baseUrl: "",
    modelHint: "",
    keyRequired: false,
    note: "Rule-based explanations of the commands Tollgate gates. Nothing leaves the server.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    provider: "anthropic",
    baseUrl: "",
    modelHint: "claude-haiku-5-5",
    keyRequired: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    provider: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    modelHint: "your model id",
    keyRequired: true,
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    provider: "openai_compatible",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    modelHint: "e.g. meta/llama-3.1-8b-instruct",
    keyRequired: true,
  },
  {
    id: "groq",
    label: "Groq",
    provider: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    modelHint: "your model id",
    keyRequired: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    provider: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    modelHint: "e.g. provider/model-name",
    keyRequired: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    provider: "openai_compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelHint: "your model id",
    keyRequired: true,
  },
  {
    id: "ollama",
    label: "Ollama (self-hosted)",
    provider: "openai_compatible",
    baseUrl: "https://your-ollama-host/v1",
    modelHint: "e.g. llama3.2",
    keyRequired: false,
    note: "Must be reachable from the internet over https (e.g. behind a reverse proxy or tunnel). localhost won't work.",
  },
  {
    id: "custom",
    label: "Other OpenAI-compatible",
    provider: "openai_compatible",
    baseUrl: "https://",
    modelHint: "model id",
    keyRequired: false,
    note: "vLLM, LM Studio, Together, Mistral, DeepSeek, Azure-hosted, or any /chat/completions server.",
  },
];

export const aiConfigSchema = z
  .object({
    provider: z.enum(["builtin", "anthropic", "openai_compatible"]),
    label: z.string().trim().max(60).optional(),
    baseUrl: z.string().trim().max(300).optional(),
    model: z.string().trim().max(120).optional(),
    // Omitted keeps the saved key; "" removes it.
    apiKey: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provider !== "builtin" && !value.model) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Choose a model" });
    }
    if (value.provider === "openai_compatible" && !value.baseUrl) {
      ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "Enter the provider's base URL" });
    }
  });

export type AiConfigInput = z.infer<typeof aiConfigSchema>;

// What the browser sees: never the key, only whether one is saved and its last 4 characters.
export type AiConfigView = {
  provider: ProviderKind;
  label: string | null;
  baseUrl: string | null;
  model: string | null;
  hasKey: boolean;
  keyLast4: string | null;
  canSaveKeys: boolean;
};

export type WhyResult = {
  text: string;
  source: "ai" | "builtin";
  model: string | null;
  // True when the team's provider failed and the built-in explanation was used instead.
  fallback: boolean;
};
