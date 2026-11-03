import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  env: {
    AI_KEYS_SECRET: "test-secret-for-ai-keys-0123456789abcdef" as string | undefined,
    AI_API_KEY: undefined as string | undefined,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => envMock);
vi.mock("@/lib/safe-url", () => ({ assertPublicUrl: async (url: string) => new URL(url) }));

const { explainWith, stripReasoning } = await import("@/features/why/server/explain");
const { resolveProvider, saveAiConfig, providerFromInput, AiConfigError } =
  await import("@/features/why/server/config");
const { sealSecret, openSecret } = await import("@/lib/crypto-box");

const input = {
  command: "npx prisma migrate deploy",
  context: "DROP TABLE x;",
  preset: "db-migrate",
  env: "staging",
  repo: "acme/x",
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("OpenAI-compatible adapter", () => {
  const config = {
    provider: "openai_compatible" as const,
    model: "llama3.2",
    baseUrl: "https://llm.example.com/v1/",
    apiKey: "nv-key-123",
  };

  it("sends a chat completion with the system rules and returns the answer", async () => {
    const { impl, calls } = fakeFetch(200, {
      choices: [{ message: { content: "<think>hmm</think>It drops table x." } }],
    });
    await expect(explainWith(config, input, impl)).resolves.toBe("It drops table x.");
    expect(calls[0]!.url).toBe("https://llm.example.com/v1/chat/completions");
    expect(calls[0]!.init.redirect).toBe("error");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer nv-key-123",
    );
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.model).toBe("llama3.2");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("<command>");
  });

  it("sends no Authorization header for keyless servers like Ollama", async () => {
    const { impl, calls } = fakeFetch(200, { choices: [{ message: { content: "ok" } }] });
    await explainWith({ ...config, apiKey: null }, input, impl);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limited"],
    [404, "bad_request"],
    [500, "failed"],
  ])("maps HTTP %i to %s", async (status, reason) => {
    const { impl } = fakeFetch(status, {});
    await expect(explainWith(config, input, impl)).rejects.toMatchObject({ reason });
  });

  it("treats a network failure and an empty answer sensibly", async () => {
    const failing = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    await expect(explainWith(config, input, failing)).rejects.toMatchObject({ reason: "failed" });
    const { impl } = fakeFetch(200, { choices: [] });
    await expect(explainWith(config, input, impl)).resolves.toBeNull();
  });

  it("strips reasoning blocks", () => {
    expect(stripReasoning("<think>a\nb</think>Answer")).toBe("Answer");
    expect(stripReasoning("leftover</think>Answer")).toBe("Answer");
  });
});

type Row = {
  teamId: string;
  provider: "builtin" | "anthropic" | "openai_compatible";
  label: string | null;
  baseUrl: string | null;
  model: string | null;
  apiKeySealed: string | null;
  apiKeyLast4: string | null;
  updatedById: string | null;
  updatedAt: Date;
};

const row = (patch: Partial<Row>): Row => ({
  teamId: "T",
  provider: "builtin",
  label: null,
  baseUrl: null,
  model: null,
  apiKeySealed: null,
  apiKeyLast4: null,
  updatedById: null,
  updatedAt: new Date(),
  ...patch,
});

describe("resolveProvider", () => {
  beforeEach(() => {
    envMock.env.AI_API_KEY = undefined;
  });

  it("uses the team's provider with its decrypted key", () => {
    const sealed = sealSecret("sk-team", envMock.env.AI_KEYS_SECRET!);
    expect(
      resolveProvider(
        row({ provider: "anthropic", model: "claude-haiku-5-5", apiKeySealed: sealed }),
      ),
    ).toMatchObject({
      provider: "anthropic",
      apiKey: "sk-team",
    });
  });

  it("allows keyless OpenAI-compatible servers", () => {
    expect(
      resolveProvider(
        row({
          provider: "openai_compatible",
          model: "llama3.2",
          baseUrl: "https://o.example.com/v1",
        }),
      ),
    ).toMatchObject({ provider: "openai_compatible", apiKey: null });
  });

  it("falls back to the server default, and to built-in when there is none", () => {
    expect(resolveProvider(null)).toBeNull();
    envMock.env.AI_API_KEY = "sk-server";
    expect(resolveProvider(null)).toMatchObject({ provider: "anthropic", apiKey: "sk-server" });
    // A team that explicitly chose built-in stays on built-in.
    expect(resolveProvider(row({ provider: "builtin" }))).toBeNull();
  });
});

function fakeDb(saved: Row | null) {
  let stored = saved;
  return {
    db: {
      teamAiConfig: {
        findUnique: vi.fn(async () => stored),
        upsert: vi.fn(async ({ create, update }: { create: Row; update: Partial<Row> }) => {
          stored = stored ? { ...stored, ...update } : { ...row({}), ...create };
          return stored;
        }),
      },
    } as never,
    get: () => stored,
  };
}

describe("saveAiConfig", () => {
  it("encrypts a new key and keeps only its last four characters readable", async () => {
    const { db, get } = fakeDb(null);
    await saveAiConfig(db, {
      teamId: "T",
      userId: "U",
      config: {
        provider: "openai_compatible",
        model: "m",
        baseUrl: "https://x.example.com/v1",
        apiKey: "nvapi-SECRET-9876",
      },
    });
    expect(get()!.apiKeySealed).not.toContain("SECRET");
    expect(openSecret(get()!.apiKeySealed!, envMock.env.AI_KEYS_SECRET!)).toBe("nvapi-SECRET-9876");
    expect(get()!.apiKeyLast4).toBe("9876");
  });

  it("never carries a key over to a different provider", async () => {
    const sealed = sealSecret("sk-anthropic", envMock.env.AI_KEYS_SECRET!);
    const { db, get } = fakeDb(
      row({
        provider: "anthropic",
        model: "claude-haiku-5-5",
        apiKeySealed: sealed,
        apiKeyLast4: "opic",
      }),
    );
    await saveAiConfig(db, {
      teamId: "T",
      userId: "U",
      config: { provider: "openai_compatible", model: "m", baseUrl: "https://x.example.com/v1" },
    });
    expect(get()!.apiKeySealed).toBeNull();
    const provider = await providerFromInput(
      { provider: "openai_compatible", model: "m", baseUrl: "https://x.example.com/v1" },
      row({ provider: "anthropic", apiKeySealed: sealed }),
    );
    expect(provider).toMatchObject({ apiKey: null });
  });

  it("requires a key for Anthropic and the server secret to store any key", async () => {
    const { db } = fakeDb(null);
    await expect(
      saveAiConfig(db, {
        teamId: "T",
        userId: "U",
        config: { provider: "anthropic", model: "claude-haiku-5-5" },
      }),
    ).rejects.toBeInstanceOf(AiConfigError);
    const previous = envMock.env.AI_KEYS_SECRET;
    envMock.env.AI_KEYS_SECRET = undefined;
    await expect(
      saveAiConfig(db, {
        teamId: "T",
        userId: "U",
        config: { provider: "anthropic", model: "claude-haiku-5-5", apiKey: "sk-x" },
      }),
    ).rejects.toMatchObject({ reason: "keys_not_configured" });
    envMock.env.AI_KEYS_SECRET = previous;
  });

  it("clears the key and model when switching to built-in", async () => {
    const sealed = sealSecret("sk", envMock.env.AI_KEYS_SECRET!);
    const { db, get } = fakeDb(row({ provider: "anthropic", model: "m", apiKeySealed: sealed }));
    await saveAiConfig(db, { teamId: "T", userId: "U", config: { provider: "builtin" } });
    expect(get()).toMatchObject({ provider: "builtin", model: null, apiKeySealed: null });
  });
});
