import { mkdtempSync, readdirSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESETS } from "@/features/gates/shared/presets";
import {
  agentTask,
  decide,
  rememberTask,
  reportRun,
  stepText,
  type HookApi,
  type HookDeps,
} from "@/packages/cli/src/hook";
import {
  NOTES_TTL_MS,
  notesFile,
  pruneNotes,
  readNotes,
  recordStep,
  saveTask,
  type SessionNotes,
} from "@/packages/cli/src/session";
import { HOOK_MATCHER, mergeHookSettings } from "@/packages/cli/src/init";

const home = () => mkdtempSync(join(tmpdir(), "tollgate-notes-"));

describe("session notes", () => {
  it("keeps the latest instruction and the last five calls since it, privately", () => {
    const dir = home();
    saveTask(dir, "s1", "  Ship the billing fix to staging  ", 1000);
    for (let i = 1; i <= 7; i += 1) recordStep(dir, "s1", `$ step ${i}`, 1000 + i);
    const notes = readNotes(dir, "s1");
    expect(notes.task).toEqual({ text: "Ship the billing fix to staging", at: 1000 });
    expect(notes.steps.map((s) => s.text)).toEqual([
      "$ step 3",
      "$ step 4",
      "$ step 5",
      "$ step 6",
      "$ step 7",
    ]);
    expect(statSync(notesFile(dir, "s1")).mode & 0o777).toBe(0o600);
    // A new instruction starts over.
    saveTask(dir, "s1", "Now roll it back", 2000);
    expect(readNotes(dir, "s1")).toEqual({
      task: { text: "Now roll it back", at: 2000 },
      steps: [],
    });
  });

  it("clips long text, survives missing or broken files and odd session ids", () => {
    const dir = home();
    saveTask(dir, "../../etc/passwd", "x".repeat(900), 1);
    expect(notesFile(dir, "../../etc/passwd")).toBe(join(dir, "sessions", "etcpasswd.json"));
    expect(readNotes(dir, "../../etc/passwd").task!.text.length).toBe(500);
    expect(readNotes(dir, "nope")).toEqual({ task: null, steps: [] });
  });

  it("deletes notes from sessions older than a week", () => {
    const dir = home();
    saveTask(dir, "old", "a", 1);
    saveTask(dir, "new", "b", 1);
    const past = (Date.now() - NOTES_TTL_MS - 60_000) / 1000;
    utimesSync(notesFile(dir, "old"), past, past);
    pruneNotes(dir, Date.now());
    expect(readdirSync(join(dir, "sessions"))).toEqual(["new.json"]);
  });
});

describe("what a step says", () => {
  it("names the call, never an MCP tool's arguments", () => {
    expect(stepText({ tool: "bash", subject: "pnpm test\necho more" }, "PostToolUse")).toBe(
      "$ pnpm test",
    );
    expect(stepText({ tool: "bash", subject: "pnpm build" }, "PostToolUseFailure")).toBe(
      "$ pnpm build (failed)",
    );
    expect(
      stepText(
        { tool: "mcp", subject: 'mcp__stripe__create_refund {"charge":"ch_1"}' },
        "PostToolUse",
      ),
    ).toBe("mcp__stripe__create_refund");
    expect(stepText({ tool: "edit", subject: "edit src/a.ts" }, "PostToolUseFailure", true)).toBe(
      "edit src/a.ts (stopped)",
    );
    expect(stepText({ tool: "bash", subject: "x".repeat(400) }, "PostToolUse").length).toBe(160);
  });

  it("redacts the task and steps with the repo's secrets before sending", () => {
    const notes: SessionNotes = {
      task: { text: "deploy with key supersecretvalue", at: 1 },
      steps: [{ text: "$ export TOKEN=supersecretvalue", at: 2 }],
    };
    const shared = agentTask(notes, ["supersecretvalue"]);
    expect(JSON.stringify(shared)).not.toContain("supersecretvalue");
    expect(agentTask({ task: null, steps: [] }, [])).toEqual({ task: null, steps: [] });
  });
});

function deps(options: { shareTask?: boolean; linked?: boolean } = {}) {
  const dir = home();
  const api: HookApi = {
    consumeGrant: vi.fn(async () => ({ ok: false, shareTask: options.shareTask })),
    createGate: vi.fn(async () => ({
      id: "G".repeat(32),
      code: 1,
      status: "approved" as const,
      quorum: 1,
      approvals: 1,
      denyReason: null,
      decidedBy: "Ana",
      mode: "guard" as const,
      url: "u",
    })),
    getGate: vi.fn(),
    park: vi.fn(),
    reportOutcome: vi.fn(async () => ({})),
    reportBypass: vi.fn(async () => ({})),
  };
  const hookDeps: HookDeps = {
    loadConfig: () =>
      options.linked === false
        ? null
        : {
            repoRoot: "/w/acme",
            server: "https://t.test",
            repo: "acme/billing",
            presets: DEFAULT_PRESETS,
            hookTimeoutSec: 60,
          },
    loadToken: () => "tg_token",
    api: () => api,
    envSecrets: () => ["supersecretvalue"],
    gitBranch: () => "main",
    context: () => "",
    env: {},
    home: "/home/dev",
    now: () => 0,
    sleep: async () => undefined,
    audit: vi.fn(),
    progress: vi.fn(),
    newId: () => "B".repeat(32),
    notes: {
      read: (id) => readNotes(dir, id),
      saveTask: (id, text) => saveTask(dir, id, text, 1),
      recordStep: (id, text) => recordStep(dir, id, text, 2),
    },
  };
  return { deps: hookDeps, api, dir };
}

const at = { cwd: "/w/acme", session_id: "s1" };

describe("sharing the agent's task", () => {
  it("sends the instruction and the calls since it when the team shares them", async () => {
    const { deps: d, api } = deps({ shareTask: true });
    rememberTask(
      { ...at, hook_event_name: "UserPromptSubmit", prompt: "Ship billing v2 to prod" },
      d,
    );
    await reportRun(
      {
        ...at,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
      },
      d,
    );
    await decide({ ...at, tool_name: "Bash", tool_input: { command: "vercel --prod" } }, d);
    expect(vi.mocked(api.createGate).mock.calls[0]![0]).toMatchObject({
      task: "Ship billing v2 to prod",
      steps: ["$ pnpm test"],
    });
  });

  it("sends nothing when the team hasn't turned it on (or the server is older)", async () => {
    for (const shareTask of [false, undefined]) {
      const { deps: d, api } = deps({ shareTask });
      rememberTask({ ...at, hook_event_name: "UserPromptSubmit", prompt: "secret plans" }, d);
      await decide({ ...at, tool_name: "Bash", tool_input: { command: "vercel --prod" } }, d);
      const body = vi.mocked(api.createGate).mock.calls[0]![0];
      expect(body).not.toHaveProperty("task");
      expect(body).not.toHaveProperty("steps");
    }
  });

  it("keeps no notes outside linked repos, and redacts before writing", () => {
    const unlinked = deps({ linked: false });
    expect(
      rememberTask({ ...at, hook_event_name: "UserPromptSubmit", prompt: "hello" }, unlinked.deps),
    ).toBe(false);
    const linked = deps();
    rememberTask(
      { ...at, hook_event_name: "UserPromptSubmit", prompt: "use supersecretvalue" },
      linked.deps,
    );
    expect(readNotes(linked.dir, "s1").task!.text).not.toContain("supersecretvalue");
  });

  it("registers the prompt hook once, async, without a matcher", () => {
    const command = 'node "/x/tollgate.mjs" hook';
    const merged = mergeHookSettings(mergeHookSettings({}, command, 300), command, 300);
    expect(merged.hooks!.UserPromptSubmit).toEqual([
      { hooks: [{ type: "command", command, timeout: 15, async: true }] },
    ]);
    expect(merged.hooks!.PreToolUse![0]!.matcher).toBe(HOOK_MATCHER);
  });
});
