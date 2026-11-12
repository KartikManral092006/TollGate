import {
  commandHash,
  type HookGateStatus,
  type ReportOutcomeInput,
} from "../../../features/gates/shared/hook-api";
import { OUTPUT_TAIL_MAX, type GateOutcome } from "../../../features/gates/shared/outcomes";
import {
  matchCommand,
  withDefaultPresets,
  TOOL_NOUN as NOUN,
  type CommandMatch,
  type GateTool,
  type Preset,
} from "../../../features/gates/shared/presets";
import { redact, truncate } from "../../../features/gates/shared/redact";
import { EDIT_TOOLS, readToolCall, type ToolCall } from "./tool-call";

// The PreToolUse decision. Spike T0 (Nov 3) showed two facts this file is built around:
//  - a deny reason reaches the model verbatim, so it is written as an instruction;
//  - when a hook exceeds its timeout Claude Code RUNS the command (fail open), so this hook
//    must always decide on its own well before the configured timeout.

export type HookInput = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: { command?: unknown; description?: unknown } & Record<string, unknown>;
  cwd?: string;
  session_id?: string;
  // PostToolUse: the tool's result (Bash: stdout, stderr, interrupted).
  tool_response?: unknown;
  // PostToolUseFailure: the error text (Bash: "Exit code N" then the output) and whether it
  // was an abort.
  error?: unknown;
  is_interrupt?: unknown;
  duration_ms?: unknown;
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
  reportOutcome(body: ReportOutcomeInput): Promise<unknown>;
};

export type HookDeps = {
  loadConfig(cwd: string): RepoConfig | null;
  loadToken(repoRoot: string): string | null;
  api(config: RepoConfig, token: string): HookApi;
  envSecrets(repoRoot: string): string[];
  gitBranch(repoRoot: string): string | null;
  context(command: string, repoRoot: string): string;
  // package.json scripts near `cwd`, for see-through matching of "pnpm db:deploy".
  readScripts?(cwd: string, repoRoot: string): Record<string, string> | null;
  env: Record<string, string | undefined>;
  // The user's home folder, to show edits outside the repo as ~/…
  home: string;
  now(): number;
  sleep(ms: number): Promise<void>;
  audit(event: string, detail: Record<string, unknown>): void;
  progress(message: string): void;
};

// 2 s keeps a 5-minute wait at ~150 requests (and Redis commands) per gate.
export const POLL_MS = 2000;
// The hook stops waiting this long before Claude Code's timeout and parks the gate.
export const PARK_MARGIN_SEC = 15;

export function denyMessages(gate: HookGateStatus, tool: GateTool = "bash") {
  const who = gate.decidedBy || "a teammate";
  const noun = NOUN[tool];
  // Only a Bash call carries a description the team can read, so only it can carry an answer.
  const question =
    tool === "bash"
      ? `${who} asked a question in TG-${gate.code} before deciding: "${gate.question}" Answer it specifically and honestly in the description of your next Bash call, then run the same command again so the team can decide. If the answer changes your plan, change the command too.`
      : `${who} asked a question in TG-${gate.code} before deciding: "${gate.question}" Answer it to the user, then make the same ${noun} again so the team can decide. If the answer changes your plan, change the ${noun} too.`;
  return {
    denied: gate.question
      ? question
      : `Denied by ${who} in TG-${gate.code}: ${gate.denyReason ?? "no reason given"}. Do not retry this ${noun} as is. Change your plan to address the reason, then propose the new ${noun}.`,
    parked: `Parked as TG-${gate.code}: nobody on the team decided in time. Continue with other work that doesn't need this ${noun}. Retry the exact same ${noun} later; once the team approves TG-${gate.code} it passes immediately (${gate.url}).`,
    expired: `TG-${gate.code} expired without approval. Ask the user whether to raise it again.`,
  };
}

export function notLinkedMessage(tool: GateTool = "bash"): string {
  return `Tollgate blocked this ${NOUN[tool]} because this repo is not linked on this machine. Ask the user to run: npx tollgate-cli init`;
}

export function failClosedMessage(server: string, error: unknown, tool: GateTool = "bash"): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Tollgate could not reach ${server} (${detail}), so this risky ${NOUN[tool]} was blocked to be safe. Tell the user; do not try to work around it.`;
}

type GatedCall = {
  config: RepoConfig;
  call: ToolCall;
  match: CommandMatch;
  cwd: string;
  command: string;
  isBash: boolean;
};

// Whether this tool call is one the repo's presets gate. Shared by the decision before the
// call and the report after it, so both see exactly the same calls.
function findGatedCall(
  input: HookInput,
  deps: HookDeps,
): GatedCall | { none: true; note?: string } {
  const toolName = input.tool_name ?? "";
  const isBash = toolName === "Bash";
  if (!isBash && !EDIT_TOOLS.has(toolName) && !toolName.startsWith("mcp__")) {
    return { none: true };
  }
  const command =
    isBash && typeof input.tool_input?.command === "string" ? input.tool_input.command : "";
  const cwd = input.cwd || process.cwd();
  if (isBash && !command.trim()) return { none: true };

  const config = deps.loadConfig(cwd);
  if (!config) return { none: true, note: "no .tollgate.json" };

  const call: ToolCall | null = isBash
    ? { tool: "bash", subject: command, hashSource: command, detail: "" }
    : readToolCall(toolName, input.tool_input, { cwd, repoRoot: config.repoRoot, home: deps.home });
  if (!call) return { none: true };

  const match = matchCommand(withDefaultPresets(config.presets), {
    command: call.subject,
    cwd,
    repoRoot: config.repoRoot,
    tool: call.tool,
    readScripts:
      isBash && deps.readScripts ? (dir) => deps.readScripts!(dir, config.repoRoot) : undefined,
  });
  if (!match) return { none: true };
  return { config, call, match, cwd, command, isBash };
}

export async function decide(input: HookInput, deps: HookDeps): Promise<Decision> {
  const found = findGatedCall(input, deps);
  if ("none" in found) return found.note ? { kind: "none", note: found.note } : { kind: "none" };
  const { config, call, match, cwd, command, isBash } = found;

  // A human can start Claude Code with TOLLGATE_BYPASS=1 in an emergency. The agent can't
  // set it: the hook inherits Claude Code's environment, not the Bash tool's shell.
  if (deps.env.TOLLGATE_BYPASS === "1") {
    deps.audit("bypass", { preset: match.preset.name, repo: config.repo });
    return { kind: "none", note: "TOLLGATE_BYPASS=1" };
  }

  if (config.error) {
    return {
      kind: "deny",
      reason: `Tollgate blocked this ${NOUN[call.tool]} because .tollgate.json is invalid (${config.error}). Ask the user to fix it or run: npx tollgate-cli init`,
    };
  }

  const token = deps.loadToken(config.repoRoot);
  if (!token) return { kind: "deny", reason: notLinkedMessage(call.tool) };

  const started = deps.now();
  const deadline = started + Math.max(5, config.hookTimeoutSec - PARK_MARGIN_SEC) * 1000;
  const cmdHash = commandHash({ repo: config.repo, cwd, command: call.hashSource });
  const api = deps.api(config, token);

  try {
    const grant = await api.consumeGrant(cmdHash);
    if (grant.ok) {
      return grant.mode === "delegate"
        ? { kind: "allow", reason: "Approved earlier by the team (single-use grant)." }
        : { kind: "none", note: "grant redeemed" };
    }

    const secrets = deps.envSecrets(config.repoRoot);
    const redactedCommand = redact(call.subject, secrets);
    const redactedCwd = redact(cwd, secrets);
    // A command's context comes from what actually runs, so "pnpm db:deploy" still shows the
    // migration SQL. An edit's context is the change itself.
    const context = redact(
      isBash ? deps.context(`${command}\n${match.segment}`, config.repoRoot) : call.detail,
      secrets,
    );
    const via =
      match.via.length > 0
        ? {
            from: redact(match.via.join(" → "), secrets),
            runs: redact(match.segment, secrets),
          }
        : null;
    const branch = deps.gitBranch(config.repoRoot);
    // The agent's own reason, shown to approvers as its claim (it can be wrong).
    const description = isBash ? input.tool_input?.description : undefined;
    const intent =
      typeof description === "string" && description.trim()
        ? redact(description.trim(), secrets)
        : null;

    let gate = await api.createGate({
      preset: match.preset.name,
      // Only sent when it isn't a command, so servers from before file gates still accept it.
      ...(call.tool === "bash" ? {} : { tool: call.tool }),
      quorum: match.quorum,
      env: match.env,
      command: truncate(redactedCommand.text, 4000),
      cwd: truncate(redactedCwd.text, 500),
      branch: branch ? truncate(redact(branch, secrets).text, 200) : null,
      context: truncate(context.text, 2048),
      intent: intent ? truncate(intent.text, 300) : null,
      via: via
        ? [{ from: truncate(via.from.text, 300), runs: truncate(via.runs.text, 1000) }]
        : undefined,
      redactions:
        redactedCommand.count +
        redactedCwd.count +
        context.count +
        (intent?.count ?? 0) +
        (via ? via.from.count + via.runs.count : 0),
      cmdHash,
      sessionId: input.session_id,
      waitSec: Math.round((deadline - started) / 1000),
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
      const messages = denyMessages(gate, call.tool);
      if (gate.status === "denied") return { kind: "deny", reason: messages.denied };
      if (gate.status === "expired") return { kind: "deny", reason: messages.expired };
      if (gate.status === "parked") return { kind: "deny", reason: messages.parked };

      if (deps.now() + POLL_MS >= deadline) {
        await api.park(gate.id).catch(() => undefined);
        return { kind: "deny", reason: messages.parked };
      }
      await deps.sleep(POLL_MS);
      gate = await api.getGate(gate.id).catch(() => gate);
    }
  } catch (error) {
    return { kind: "deny", reason: failClosedMessage(config.server, error, call.tool) };
  }
}

// The last lines of what a call printed: enough to see why it failed, never the whole log.
export const OUTPUT_TAIL_LINES = 15;

export function outputTail(text: string, secrets: readonly string[]): string | null {
  const lines = text.replace(/\s+$/, "").split("\n");
  const tail = lines.slice(-OUTPUT_TAIL_LINES).join("\n");
  const clipped =
    tail.length > OUTPUT_TAIL_MAX - 2 ? `…${tail.slice(-(OUTPUT_TAIL_MAX - 2))}` : tail;
  const cleaned = redact(clipped, secrets).text.trim();
  return cleaned ? truncate(cleaned, OUTPUT_TAIL_MAX) : null;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

// What PostToolUse / PostToolUseFailure says happened, in the shape the server stores. Pure.
export function describeRun(
  input: HookInput,
  tool: GateTool,
  secrets: readonly string[],
): Omit<ReportOutcomeInput, "cmdHash"> {
  const durationMs =
    typeof input.duration_ms === "number" && Number.isFinite(input.duration_ms)
      ? Math.max(0, Math.round(input.duration_ms))
      : null;
  if (input.hook_event_name === "PostToolUseFailure") {
    const error = str(input.error);
    // Bash and PowerShell failures start with "Exit code N" when the command ran and exited.
    const exit = /^Exit code (-?\d+)\s*(?:\n|$)/.exec(error);
    const exitCode = exit ? Number(exit[1]) : null;
    const outcome: GateOutcome = input.is_interrupt === true ? "interrupted" : "failed";
    return {
      outcome,
      exitCode: exitCode !== null && exitCode >= -1 && exitCode <= 255 ? exitCode : null,
      durationMs,
      output: outputTail(exit ? error.slice(exit[0].length) : error, secrets),
    };
  }
  const response = (
    input.tool_response && typeof input.tool_response === "object" ? input.tool_response : {}
  ) as Record<string, unknown>;
  // An MCP result or an edit's response is data the team didn't ask to see; only a command's
  // own output is kept.
  const printed =
    tool === "bash" ? [str(response.stdout), str(response.stderr)].filter(Boolean).join("\n") : "";
  return {
    outcome: response.interrupted === true ? "interrupted" : "succeeded",
    exitCode: null,
    durationMs,
    output: printed ? outputTail(printed, secrets) : null,
  };
}

// After a gated call ran: tell the server how it went. Runs as an async hook, so it never
// slows the agent down, prints nothing and never throws.
export async function reportRun(input: HookInput, deps: HookDeps): Promise<boolean> {
  const found = findGatedCall(input, deps);
  if ("none" in found || found.config.error) return false;
  const { config, call, cwd } = found;
  const token = deps.loadToken(config.repoRoot);
  if (!token) return false;
  const report: ReportOutcomeInput = {
    cmdHash: commandHash({ repo: config.repo, cwd, command: call.hashSource }),
    ...describeRun(input, call.tool, deps.envSecrets(config.repoRoot)),
  };
  try {
    await deps.api(config, token).reportOutcome(report);
    return true;
  } catch {
    return false;
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
