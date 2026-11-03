import { commandHash, type HookGateStatus } from "../../../features/gates/shared/hook-api";
import { matchPreset, type Preset } from "../../../features/gates/shared/presets";
import { redact, truncate } from "../../../features/gates/shared/redact";

// The PreToolUse decision. Spike T0 (Nov 3) showed two facts this file is built around:
//  - a deny reason reaches the model verbatim, so it is written as an instruction;
//  - when a hook exceeds its timeout Claude Code RUNS the command (fail open), so this hook
//    must always decide on its own well before the configured timeout.

export type HookInput = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: { command?: unknown; description?: unknown };
  cwd?: string;
  session_id?: string;
};

export type Decision =
  | { kind: "none"; note?: string } // exit 0, no output: Claude Code's normal permission flow
  | { kind: "allow"; reason: string }
  | { kind: "deny"; reason: string };

export type RepoConfig = {
  repoRoot: string;
  server: string;
  repo: string;
  presets: Preset[];
  hookTimeoutSec: number;
  // Set when .tollgate.json exists but can't be read: risky commands are then blocked.
  error?: string;
};

export type HookApi = {
  consumeGrant(cmdHash: string): Promise<{ ok: boolean; mode?: "guard" | "delegate" }>;
  createGate(body: Record<string, unknown>): Promise<HookGateStatus>;
  getGate(id: string): Promise<HookGateStatus>;
  park(id: string): Promise<{ status: string }>;
};

export type HookDeps = {
  loadConfig(cwd: string): RepoConfig | null;
  loadToken(repoRoot: string): string | null;
  api(config: RepoConfig, token: string): HookApi;
  envSecrets(repoRoot: string): string[];
  gitBranch(repoRoot: string): string | null;
  context(command: string, repoRoot: string): string;
  env: Record<string, string | undefined>;
  now(): number;
  sleep(ms: number): Promise<void>;
  audit(event: string, detail: Record<string, unknown>): void;
  progress(message: string): void;
};

// 2 s keeps a 5-minute wait at ~150 requests (and Redis commands) per gate.
export const POLL_MS = 2000;
// The hook stops waiting this long before Claude Code's timeout and parks the gate.
export const PARK_MARGIN_SEC = 15;

export function denyMessages(gate: HookGateStatus) {
  const who = gate.decidedBy || "a teammate";
  return {
    denied: gate.question
      ? `${who} asked a question in TG-${gate.code} before deciding: "${gate.question}" Answer it specifically and honestly in the description of your next Bash call, then run the same command again so the team can decide. If the answer changes your plan, change the command too.`
      : `Denied by ${who} in TG-${gate.code}: ${gate.denyReason ?? "no reason given"}. Do not retry this command as is. Change your plan to address the reason, then propose the new command.`,
    parked: `Parked as TG-${gate.code}: nobody on the team decided in time. Continue with other work that doesn't need this command. Retry the exact same command later; once the team approves TG-${gate.code} it passes immediately (${gate.url}).`,
    expired: `TG-${gate.code} expired without approval. Ask the user whether to raise it again.`,
  };
}

export function notLinkedMessage(): string {
  return "Tollgate blocked this command because this repo is not linked on this machine. Ask the user to run: npx tollgate-cli init";
}

export function failClosedMessage(server: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Tollgate could not reach ${server} (${detail}), so this risky command was blocked to be safe. Tell the user; do not try to work around it.`;
}

export async function decide(input: HookInput, deps: HookDeps): Promise<Decision> {
  if (input.tool_name !== "Bash") return { kind: "none" };
  const command = typeof input.tool_input?.command === "string" ? input.tool_input.command : "";
  const cwd = input.cwd || process.cwd();
  if (!command.trim()) return { kind: "none" };

  const config = deps.loadConfig(cwd);
  if (!config) return { kind: "none", note: "no .tollgate.json" };

  const match = matchPreset(config.presets, { command, cwd, repoRoot: config.repoRoot });
  if (!match) return { kind: "none" };

  // A human can start Claude Code with TOLLGATE_BYPASS=1 in an emergency. The agent can't
  // set it: the hook inherits Claude Code's environment, not the Bash tool's shell.
  if (deps.env.TOLLGATE_BYPASS === "1") {
    deps.audit("bypass", { preset: match.preset.name, repo: config.repo });
    return { kind: "none", note: "TOLLGATE_BYPASS=1" };
  }

  if (config.error) {
    return {
      kind: "deny",
      reason: `Tollgate blocked this command because .tollgate.json is invalid (${config.error}). Ask the user to fix it or run: npx tollgate-cli init`,
    };
  }

  const token = deps.loadToken(config.repoRoot);
  if (!token) return { kind: "deny", reason: notLinkedMessage() };

  const started = deps.now();
  const deadline = started + Math.max(5, config.hookTimeoutSec - PARK_MARGIN_SEC) * 1000;
  const cmdHash = commandHash({ repo: config.repo, cwd, command });
  const api = deps.api(config, token);

  try {
    const grant = await api.consumeGrant(cmdHash);
    if (grant.ok) {
      return grant.mode === "delegate"
        ? { kind: "allow", reason: "Approved earlier by the team (single-use grant)." }
        : { kind: "none", note: "grant redeemed" };
    }

    const secrets = deps.envSecrets(config.repoRoot);
    const redactedCommand = redact(command, secrets);
    const redactedCwd = redact(cwd, secrets);
    const context = redact(deps.context(command, config.repoRoot), secrets);
    const branch = deps.gitBranch(config.repoRoot);
    // The agent's own reason, shown to approvers as its claim (it can be wrong).
    const description = input.tool_input?.description;
    const intent =
      typeof description === "string" && description.trim()
        ? redact(description.trim(), secrets)
        : null;

    let gate = await api.createGate({
      preset: match.preset.name,
      quorum: match.quorum,
      env: match.env,
      command: truncate(redactedCommand.text, 4000),
      cwd: truncate(redactedCwd.text, 500),
      branch: branch ? truncate(redact(branch, secrets).text, 200) : null,
      context: truncate(context.text, 2048),
      intent: intent ? truncate(intent.text, 300) : null,
      redactions: redactedCommand.count + redactedCwd.count + context.count + (intent?.count ?? 0),
      cmdHash,
      sessionId: input.session_id,
    });
    deps.progress(
      `Tollgate: waiting on your team · TG-${gate.code} (0/${gate.quorum}) · ${gate.url}`,
    );

    for (;;) {
      if (gate.status === "approved") {
        return gate.mode === "delegate"
          ? { kind: "allow", reason: `Approved by the team in TG-${gate.code}.` }
          : { kind: "none", note: `TG-${gate.code} approved` };
      }
      if (gate.status === "denied") return { kind: "deny", reason: denyMessages(gate).denied };
      if (gate.status === "expired") return { kind: "deny", reason: denyMessages(gate).expired };
      if (gate.status === "parked") return { kind: "deny", reason: denyMessages(gate).parked };

      if (deps.now() + POLL_MS >= deadline) {
        await api.park(gate.id).catch(() => undefined);
        return { kind: "deny", reason: denyMessages(gate).parked };
      }
      await deps.sleep(POLL_MS);
      gate = await api.getGate(gate.id).catch(() => gate);
    }
  } catch (error) {
    return { kind: "deny", reason: failClosedMessage(config.server, error) };
  }
}

export function renderDecision(decision: Decision): string | null {
  if (decision.kind === "none") return null;
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision.kind,
      permissionDecisionReason: decision.reason,
    },
  });
}
