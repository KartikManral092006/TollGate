import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { reportBypassSchema } from "@/features/gates/shared/hook-api";
import { DEFAULT_PRESETS } from "@/features/gates/shared/presets";
import { ApiError } from "@/packages/cli/src/api";
import {
  decide,
  outboxResult,
  reportRun,
  type HookApi,
  type HookDeps,
} from "@/packages/cli/src/hook";
import {
  addToOutbox,
  flushOutbox,
  OUTBOX_TTL_MS,
  readOutbox,
  type OutboxItem,
} from "@/packages/cli/src/outbox";

const home = () => mkdtempSync(join(tmpdir(), "tollgate-outbox-"));

function setup(options: { bypass?: boolean; token?: string | null } = {}) {
  const dir = home();
  let ids = 0;
  const api: HookApi = {
    consumeGrant: vi.fn(async () => ({ ok: false })),
    createGate: vi.fn(),
    getGate: vi.fn(),
    park: vi.fn(),
    reportOutcome: vi.fn(async () => ({})),
    reportBypass: vi.fn(async () => ({ ok: true })),
  };
  const deps: HookDeps = {
    loadConfig: () => ({
      repoRoot: "/w/acme",
      server: "https://t.test",
      repo: "acme/billing",
      presets: DEFAULT_PRESETS,
      hookTimeoutSec: 60,
    }),
    loadToken: () => (options.token === undefined ? "tg_token" : options.token),
    api: () => api,
    envSecrets: () => ["supersecretvalue"],
    gitBranch: () => "hotfix",
    context: () => "Last commit: abc fix",
    env: options.bypass === false ? {} : { TOLLGATE_BYPASS: "1" },
    home: "/home/dev",
    now: () => 1_000_000,
    sleep: async () => undefined,
    audit: vi.fn(),
    progress: vi.fn(),
    newId: () => `${"B".repeat(31)}${(ids += 1)}`,
    outbox: {
      add: (item) => addToOutbox(dir, item),
      flush: (send) => flushOutbox(dir, send, 1_000_000),
    },
  };
  return { deps, api, dir };
}

const bash = (command: string, event?: string) => ({
  hook_event_name: event,
  tool_name: "Bash",
  tool_input: { command, description: "Deploy the hotfix" },
  cwd: "/w/acme",
  session_id: "s1",
});

describe("reporting a bypass", () => {
  it("lets the call through at once, queuing a redacted report instead of calling out", async () => {
    const { deps, api, dir } = setup();
    const decision = await decide(bash("API_KEY=supersecretvalue vercel --prod"), deps);
    expect(decision).toEqual({ kind: "none", note: "TOLLGATE_BYPASS=1" });
    expect(api.consumeGrant).not.toHaveBeenCalled();
    expect(api.reportBypass).not.toHaveBeenCalled();
    const [item] = readOutbox(dir);
    expect(item).toMatchObject({ kind: "bypass", server: "https://t.test", repoRoot: "/w/acme" });
    expect(JSON.stringify(item)).not.toContain("supersecretvalue");
    // The server's schema accepts exactly what was queued.
    expect(reportBypassSchema.safeParse(item!.body).success).toBe(true);
    expect(item!.body).toMatchObject({ env: "prod", intent: "Deploy the hotfix", at: 1_000_000 });
    expect(statSync(join(dir, "outbox.jsonl")).mode & 0o777).toBe(0o600);
    expect(deps.audit).toHaveBeenCalledWith("bypass", expect.objectContaining({ reported: true }));
  });

  it("sends the queue after the call, before that call's own outcome", async () => {
    const { deps, api, dir } = setup();
    await decide(bash("vercel --prod"), deps);
    const order: string[] = [];
    vi.mocked(api.reportBypass).mockImplementation(async () => order.push("bypass"));
    vi.mocked(api.reportOutcome).mockImplementation(async () => order.push("outcome"));
    await reportRun({ ...bash("vercel --prod", "PostToolUse"), tool_response: {} }, deps);
    expect(order).toEqual(["bypass", "outcome"]);
    expect(readOutbox(dir)).toEqual([]);
  });

  it("keeps a report while offline and drops one an old server can't take", async () => {
    expect(outboxResult(new TypeError("fetch failed"))).toBe("retry");
    expect(outboxResult(new ApiError(503, "error"))).toBe("retry");
    expect(outboxResult(new ApiError(429, "rate_limited"))).toBe("retry");
    expect(outboxResult(new ApiError(404, "error"))).toBe("drop");
    expect(outboxResult(new ApiError(401, "unauthorized"))).toBe("drop");

    const { deps, api, dir } = setup();
    await decide(bash("vercel --prod"), deps);
    vi.mocked(api.reportBypass).mockRejectedValueOnce(new TypeError("fetch failed"));
    await reportRun({ ...bash("ls", "PostToolUse"), tool_response: {} }, deps);
    expect(readOutbox(dir)).toHaveLength(1);
    await reportRun({ ...bash("ls", "PostToolUse"), tool_response: {} }, deps);
    expect(readOutbox(dir)).toHaveLength(0);
    expect(api.reportBypass).toHaveBeenCalledTimes(2);
  });

  it("drops reports older than a week and keeps ones queued while sending", async () => {
    const dir = home();
    const item = (id: string, at: number): OutboxItem => ({
      kind: "bypass",
      repoRoot: "/r",
      server: "https://t.test",
      at,
      body: { id },
    });
    addToOutbox(dir, item("old", 0));
    addToOutbox(dir, item("new", OUTBOX_TTL_MS));
    const sent: string[] = [];
    await flushOutbox(
      dir,
      async (queued) => {
        sent.push(String(queued.body.id));
        addToOutbox(dir, item("during", OUTBOX_TTL_MS));
        return "sent";
      },
      OUTBOX_TTL_MS + 10,
    );
    expect(sent).toEqual(["new"]);
    expect(readOutbox(dir).map((queued) => queued.body.id)).toEqual(["during"]);
  });

  it("queues nothing for an unlinked machine, but still lets the person through", async () => {
    const { deps, dir } = setup({ token: null });
    expect(await decide(bash("vercel --prod"), deps)).toMatchObject({ kind: "none" });
    expect(readOutbox(dir)).toEqual([]);
  });
});
