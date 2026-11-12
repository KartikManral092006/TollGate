import {
  commandHash,
  STEP_MAX,
  TASK_MAX,
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
import type { OutboxItem, SendResult } from "./outbox";
import { PREVIEW_MAX, PREVIEW_MIN_TIME_MS, type PreviewInput } from "./preview";
import type { SessionNotes } from "./session";
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
  // UserPromptSubmit: what the developer just asked the agent.
  prompt?: unknown;
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
  // Read-only impact previews (preview.ts); on unless .tollgate.json says "previews": false.
  previews?: boolean;
  // Set when .tollgate.json exists but can't be read: risky commands are then blocked.
  error?: string;
};

export type HookApi = {
  consumeGrant(
    cmdHash: string,
  ): Promise<{ ok: boolean; mode?: "guard" | "delegate"; shareTask?: boolean }>;
  createGate(body: Record<string, unknown>): Promise<HookGateStatus>;
  getGate(id: string): Promise<HookGateStatus>;
  park(id: string): Promise<{ status: string }>;
  reportOutcome(body: ReportOutcomeInput): Promise<unknown>;
  reportBypass(body: Record<string, unknown>): Promise<unknown>;
  attachPreview(id: string, preview: string): Promise<unknown>;
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
  // 32 letters and digits, for a bypass report's id (the server records each id once).
  newId(): string;
  // What the command will do, from read-only checks on this machine (preview.ts).
  preview?(input: PreviewInput): string | null;
  // Reports waiting to reach the server (outbox.ts).
  outbox?: {
    add(item: OutboxItem): void;
    flush(send: (item: OutboxItem) => Promise<SendResult>): Promise<unknown>;
  };
  // This machine's notes on what the agent was asked and just did (session.ts).
  notes?: {
    read(sessionId: string): SessionNotes;
    saveTask(sessionId: string, text: string): void;
    recordStep(sessionId: string, text: string): void;
  };
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

type ReadCall = {
  config: RepoConfig;
  call: ToolCall;
  cwd: string;
  command: string;
  isBash: boolean;
};

type GatedCall = ReadCall & { match: CommandMatch };

// A Bash call, file edit or MCP call in a linked repo, in the shape presets match.
function readCall(input: HookInput, deps: HookDeps): ReadCall | { none: true; note?: string } {
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
  return { config, call, cwd, command, isBash };
}

function matchCall(read: ReadCall, deps: HookDeps): CommandMatch | null {
  const { config, call, cwd, isBash } = read;
  return matchCommand(withDefaultPresets(config.presets), {
    command: call.subject,
    cwd,
    repoRoot: config.repoRoot,
    tool: call.tool,
    readScripts:
      isBash && deps.readScripts ? (dir) => deps.readScripts!(dir, config.repoRoot) : undefined,
  });
}

// Whether this tool call is one the repo's presets gate. Shared by the decision before the
// call and the report after it, so both see exactly the same calls.
function findGatedCall(
  input: HookInput,
  deps: HookDeps,
): GatedCall | { none: true; note?: string } {
  const read = readCall(input, deps);
  if ("none" in read) return read;
  const match = matchCall(read, deps);
  return match ? { ...read, match } : { none: true };
}

// One line per call for the notes: a command's first line, an edit's path, an MCP tool's
// name (never its arguments). Redacted before it's written.
export function stepText(
  call: Pick<ToolCall, "tool" | "subject">,
  event: string | undefined,
  interrupted = false,
): string {
  const what =
    call.tool === "bash"
      ? `$ ${call.subject.split("\n")[0]!.trim()}`
      : call.tool === "mcp"
        ? call.subject.split(" ")[0]!
        : call.subject;
  const how = event === "PostToolUseFailure" ? (interrupted ? " (stopped)" : " (failed)") : "";
  const room = STEP_MAX - how.length;
  return `${what.length > room ? `${what.slice(0, room - 1)}…` : what}${how}`;
}

// What the gate carries when the team shares the agent's task: the developer's last
// instruction and the calls since, redacted again with this repo's secrets.
export function agentTask(
  notes: SessionNotes,
  secrets: readonly string[],
): { task: string | null; steps: string[] } {
  const task = notes.task ? redact(notes.task.text, secrets).text.trim() : "";
  return {
    task: task ? truncate(task, TASK_MAX) : null,
    steps: notes.steps
      .map((step) => truncate(redact(step.text, secrets).text.trim(), STEP_MAX))
      .filter(Boolean),
  };
}

// UserPromptSubmit (async): remember the developer's instruction for this session, in a
// linked repo only. Prints nothing, so nothing is added to the prompt.
export function rememberTask(input: HookInput, deps: HookDeps): boolean {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  if (!prompt.trim() || !input.session_id || !deps.notes) return false;
  const config = deps.loadConfig(input.cwd || process.cwd());
  if (!config || config.error) return false;
  try {
    deps.notes.saveTask(input.session_id, redact(prompt, deps.envSecrets(config.repoRoot)).text);
    return true;
  } catch {
    return false;
  }
}

// What a gate (or a bypass report) says about the call, redacted on this machine first.
function gateFields(found: GatedCall, input: HookInput, deps: HookDeps, secrets: string[]) {
  const { config, call, match, cwd, command, isBash } = found;
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
  return {
    preset: match.preset.name,
    // Only sent when it isn't a command, so servers from before file gates still accept it.
    ...(call.tool === "bash" ? {} : { tool: call.tool }),
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
    sessionId: input.session_id,
  };
}

// TOLLGATE_BYPASS=1: the call goes through, and the team hears about it. Queued here without
// touching the network (it's an emergency, and the server may be why), sent after the call.
function queueBypass(found: GatedCall, input: HookInput, deps: HookDeps): boolean {
  const { config, call, cwd } = found;
  if (config.error || !deps.outbox || !deps.loadToken(config.repoRoot)) return false;
  try {
    const at = deps.now();
    deps.outbox.add({
      kind: "bypass",
      repoRoot: config.repoRoot,
      server: config.server,
      at,
      body: {
        ...gateFields(found, input, deps, deps.envSecrets(config.repoRoot)),
        id: deps.newId(),
        at,
        cmdHash: commandHash({ repo: config.repo, cwd, command: call.hashSource }),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function decide(input: HookInput, deps: HookDeps): Promise<Decision> {
  const found = findGatedCall(input, deps);
  if ("none" in found) return found.note ? { kind: "none", note: found.note } : { kind: "none" };
  const { config, call, match, cwd } = found;

  // A human can start Claude Code with TOLLGATE_BYPASS=1 in an emergency. The agent can't
  // set it: the hook inherits Claude Code's environment, not the Bash tool's shell.
  if (deps.env.TOLLGATE_BYPASS === "1") {
    const queued = queueBypass(found, input, deps);
    deps.audit("bypass", { preset: match.preset.name, repo: config.repo, reported: queued });
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
    const shared =
      grant.shareTask && input.session_id && deps.notes
        ? agentTask(deps.notes.read(input.session_id), secrets)
        : null;

    let gate = await api.createGate({
      ...gateFields(found, input, deps, secrets),
      quorum: match.quorum,
      // Only to servers that asked for it, which also know these fields.
      ...(shared ? { task: shared.task, steps: shared.steps } : {}),
      cmdHash,
      waitSec: Math.round((deadline - started) / 1000),
    });
    deps.progress(
      `Tollgate: waiting on your team · TG-${gate.code} (0/${gate.quorum}) · ${gate.url}`,
    );
    // The card is up; now show the team what it will do. Read-only checks, while they look.
    if (
      gate.previews &&
      config.previews !== false &&
      deps.preview &&
      (gate.status === "pending" || gate.status === "parked") &&
      deadline - deps.now() > PREVIEW_MIN_TIME_MS
    ) {
      const text = deps.preview({
        preset: match.preset.name,
        segment: match.segment,
        cwd,
        repoRoot: config.repoRoot,
      });
      if (text) {
        await api
          .attachPreview(gate.id, truncate(redact(text, secrets).text, PREVIEW_MAX))
          .catch(() => undefined);
      }
    }

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

// After a call ran (async PostToolUse / PostToolUseFailure): note it for this session and,
// when it was gated, tell the server how it went. Prints nothing and never throws.
export async function reportRun(input: HookInput, deps: HookDeps): Promise<boolean> {
  // Queued bypasses first, so this call's outcome finds its bypassed gate on the server.
  await sendOutbox(deps);
  const read = readCall(input, deps);
  if ("none" in read || read.config.error) return false;
  const { config, call, cwd } = read;
  const secrets = deps.envSecrets(config.repoRoot);
  if (deps.notes && input.session_id) {
    try {
      const line = stepText(call, input.hook_event_name, input.is_interrupt === true);
      deps.notes.recordStep(input.session_id, redact(line, secrets).text);
    } catch {
      // notes are a nicety; never fail the hook over them
    }
  }
  if (!matchCall(read, deps)) return false;
  const token = deps.loadToken(config.repoRoot);
  if (!token) return false;
  const report: ReportOutcomeInput = {
    cmdHash: commandHash({ repo: config.repo, cwd, command: call.hashSource }),
    ...describeRun(input, call.tool, secrets),
  };
  try {
    await deps.api(config, token).reportOutcome(report);
    return true;
  } catch {
    return false;
  }
}

// What to do with a queued report the server answered: keep it only when trying again later
// can work (offline, the server erroring or busy). A server too old to know bypasses, or a
// token that's gone, won't change by retrying.
export function outboxResult(error: unknown): SendResult {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return "retry";
  if (status === 429 || status >= 500) return "retry";
  return "drop";
}

export async function sendOutbox(deps: HookDeps): Promise<void> {
  if (!deps.outbox) return;
  try {
    await deps.outbox.flush(async (item) => {
      const token = deps.loadToken(item.repoRoot);
      if (!token) return "drop";
      const config: RepoConfig = {
        repoRoot: item.repoRoot,
        server: item.server,
        repo: "",
        presets: [],
        hookTimeoutSec: 300,
      };
      try {
        await deps.api(config, token).reportBypass(item.body);
        return "sent";
      } catch (error) {
        return outboxResult(error);
      }
    });
  } catch {
    // the outbox is retried on the next call
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
