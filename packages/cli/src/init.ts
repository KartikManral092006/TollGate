import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PRESETS } from "../../../features/gates/shared/presets";
import { CONFIG_FILE, DEFAULT_HOOK_TIMEOUT_SEC, type ConfigFile, readConfigFile } from "./config";

// settings.local.json is per developer (Claude Code keeps it out of git): each person links
// the repo with their own token, so each person registers their own hook.
export const SETTINGS_FILE = join(".claude", "settings.local.json");

type HookEntry = {
  type: string;
  command: string;
  timeout?: number;
  statusMessage?: string;
  onFailure?: "block";
  async?: boolean;
};
type Matcher = { matcher?: string; hooks?: HookEntry[] };
type Settings = { hooks?: Record<string, Matcher[] | undefined> } & Record<string, unknown>;

// Commands, file edits and MCP tools. The hook itself decides what's risky; other calls cost
// one quick local check and pass.
export const HOOK_MATCHER = "Bash|Edit|Write|MultiEdit|NotebookEdit|mcp__.*";

export function isTollgateHook(command: string): boolean {
  return /tollgate/.test(command) && /\bhook\b/.test(command);
}

// After a gated call runs, the same hook reports how it went (CLI 0.3+). Async: Claude Code
// carries on while it reports, and it can never block anything.
export const REPORT_EVENTS = ["PostToolUse", "PostToolUseFailure"] as const;
const REPORT_TIMEOUT_SEC = 15;

const EVENTS = ["PreToolUse", ...REPORT_EVENTS, "UserPromptSubmit"] as const;

function withoutTollgate(matchers: Matcher[] | undefined): Matcher[] {
  return (matchers ?? [])
    .map((matcher) => ({
      ...matcher,
      hooks: (matcher.hooks ?? []).filter((hook) => !isTollgateHook(hook.command)),
    }))
    .filter((matcher) => matcher.hooks.length > 0);
}

// Idempotent: removes any earlier Tollgate hook, keeps every other hook untouched.
export function mergeHookSettings(
  existing: Settings,
  hookCommand: string,
  timeoutSec: number,
): Settings {
  const hooks = { ...(existing.hooks ?? {}) };
  for (const event of EVENTS) hooks[event] = withoutTollgate(hooks[event]);
  hooks.PreToolUse = [
    ...hooks.PreToolUse!,
    {
      matcher: HOOK_MATCHER,
      hooks: [
        {
          type: "command",
          command: hookCommand,
          timeout: timeoutSec,
          // Spinner text while a gate waits for the team.
          statusMessage: "Tollgate: checking with your team…",
          // A crashed or timed-out hook blocks instead of letting the command run
          // (Claude Code 2.1.295+). The hook's own watchdog is the second layer.
          onFailure: "block",
        },
      ],
    },
  ];
  for (const event of REPORT_EVENTS) {
    hooks[event] = [
      ...hooks[event]!,
      {
        matcher: HOOK_MATCHER,
        hooks: [
          { type: "command", command: hookCommand, timeout: REPORT_TIMEOUT_SEC, async: true },
        ],
      },
    ];
  }
  // The developer's instruction, kept on this machine for the team's opt-in "agent's task".
  // No matcher (prompts have no tool); async, so typing never waits on it.
  hooks.UserPromptSubmit = [
    ...hooks.UserPromptSubmit!,
    {
      hooks: [{ type: "command", command: hookCommand, timeout: REPORT_TIMEOUT_SEC, async: true }],
    },
  ];
  return { ...existing, hooks };
}

function readJson(path: string): Settings {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Settings;
  } catch {
    return {};
  }
}

// The hook runs on every Bash call, so it must start fast: a local copy of this bundle
// run by node, not `npx` (which adds about a second per command).
export function installBundle(bundlePath: string, home: string): string {
  const binDir = join(home, "bin");
  mkdirSync(binDir, { recursive: true });
  const target = join(binDir, "tollgate.mjs");
  if (bundlePath !== target) copyFileSync(bundlePath, target);
  return target;
}

export function hookCommandFor(bundle: string): string {
  return `node ${JSON.stringify(bundle)} hook`;
}

export function writeRepoFiles(input: {
  repoRoot: string;
  server: string;
  repo: string;
  hookCommand: string;
}): { configPath: string; settingsPath: string; timeoutSec: number } {
  const configPath = join(input.repoRoot, CONFIG_FILE);
  let config: ConfigFile = { server: input.server, repo: input.repo, presets: DEFAULT_PRESETS };
  if (existsSync(configPath)) {
    try {
      config = { ...readConfigFile(input.repoRoot), server: input.server, repo: input.repo };
    } catch {
      // Unreadable: rewrite it with defaults rather than keep a file the hook can't parse.
    }
  }
  const timeoutSec = config.hookTimeoutSec ?? DEFAULT_HOOK_TIMEOUT_SEC;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const settingsPath = join(input.repoRoot, SETTINGS_FILE);
  mkdirSync(join(input.repoRoot, ".claude"), { recursive: true });
  const merged = mergeHookSettings(readJson(settingsPath), input.hookCommand, timeoutSec);
  writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);

  const gitignore = join(input.repoRoot, ".gitignore");
  if (existsSync(gitignore)) {
    const text = readFileSync(gitignore, "utf8");
    if (!text.split(/\r?\n/).includes(".claude/settings.local.json")) {
      writeFileSync(
        gitignore,
        `${text}${text.endsWith("\n") ? "" : "\n"}.claude/settings.local.json\n`,
      );
    }
  }
  return { configPath, settingsPath, timeoutSec };
}
