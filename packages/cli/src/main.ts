import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_PRESETS } from "../../../features/gates/shared/presets";
import { createApi, whoAmI } from "./api";
import {
  buildContext,
  envSecrets,
  findRepoRoot,
  gitBranch,
  gitRepoName,
  loadConfig,
  loadToken,
  readScripts,
  removeToken,
  saveToken,
  tollgateHome,
} from "./config";
import {
  decide,
  PARK_MARGIN_SEC,
  renderDecision,
  type Decision,
  type HookDeps,
  type HookInput,
} from "./hook";
import { hookCommandFor, installBundle, writeRepoFiles } from "./init";

declare const TOLLGATE_VERSION: string;

const HELP = `tollgate ${TOLLGATE_VERSION}: your team approves risky agent commands before they run

Usage:
  npx tollgate-cli init --token <tg_…> [--server <url>] [--repo <owner/name>]
  npx tollgate-cli status
  npx tollgate-cli test        Raise a harmless test gate (echo tollgate-test)
  npx tollgate-cli unlink      Forget this repo's token on this machine
  tollgate hook                Claude Code PreToolUse hook (reads JSON on stdin)
`;

function hookDeps(): HookDeps {
  return {
    loadConfig,
    loadToken: (repoRoot) => loadToken(repoRoot),
    api: createApi,
    envSecrets,
    gitBranch,
    context: buildContext,
    readScripts,
    env: process.env,
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    audit: (event, detail) => {
      const home = tollgateHome();
      mkdirSync(home, { recursive: true });
      appendFileSync(
        join(home, "audit.log"),
        `${JSON.stringify({ at: new Date().toISOString(), event, ...detail })}\n`,
      );
      process.stderr.write(`tollgate: ${event} ${JSON.stringify(detail)}\n`);
    },
    progress: (message) => process.stderr.write(`${message}\n`),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function emit(decision: Decision): void {
  const output = renderDecision(decision);
  if (output) process.stdout.write(`${output}\n`);
}

// Claude Code runs the command if a hook overruns its timeout (spike T0), so a watchdog
// answers "deny" shortly before that, whatever a slow network is doing.
async function runHook(): Promise<void> {
  let input: HookInput;
  try {
    input = JSON.parse(await readStdin()) as HookInput;
  } catch {
    return; // not a hook payload: no opinion
  }
  const config = loadConfig(input.cwd || process.cwd());
  const timeoutSec = config?.hookTimeoutSec ?? 300;
  const watchdogMs = Math.max(3, timeoutSec - Math.min(5, PARK_MARGIN_SEC - 1)) * 1000;

  let settled = false;
  const watchdog = setTimeout(() => {
    if (settled) return;
    settled = true;
    emit({
      kind: "deny",
      reason:
        "Tollgate ran out of time waiting for the team, so this command was blocked. Continue with other work and retry the exact same command later.",
    });
    process.exit(0);
  }, watchdogMs);

  const decision = await decide(input, hookDeps()).catch((error: unknown): Decision => ({
    kind: "deny",
    reason: `Tollgate failed unexpectedly (${error instanceof Error ? error.message : String(error)}), so this command was blocked to be safe.`,
  }));
  if (settled) return;
  settled = true;
  clearTimeout(watchdog);
  emit(decision);
}

async function runInit(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      token: { type: "string" },
      server: { type: "string" },
      repo: { type: "string" },
      dir: { type: "string" },
    },
  });
  const repoRoot = resolve(values.dir ?? process.cwd());
  const token = values.token ?? process.env.TOLLGATE_TOKEN;
  const server = (values.server ?? process.env.TOLLGATE_SERVER ?? "").replace(/\/+$/, "");
  if (!token || !server) {
    throw new Error(
      "Missing --token or --server. Copy the full command from your team's Settings › Repos page.",
    );
  }
  const who = await whoAmI(server, token);
  const repo = values.repo ?? who.repo.name ?? gitRepoName(repoRoot) ?? "repo";

  const bundle = installBundle(resolve(process.argv[1] ?? ""), tollgateHome());
  const tokenFile = saveToken(repoRoot, { token, server, repo });
  const files = writeRepoFiles({ repoRoot, server, repo, hookCommand: hookCommandFor(bundle) });

  process.stdout.write(
    [
      `✓ Linked ${repo} to team "${who.team.name}" (${who.repo.mode} mode) as ${who.user.name || "you"}`,
      `✓ Token saved to ${tokenFile} (only readable by you; never in the repo)`,
      `✓ Presets in ${files.configPath}: commit this file so your team shares them`,
      `✓ Hook registered in ${files.settingsPath} (timeout ${files.timeoutSec} s)`,
      "",
      "Next: restart Claude Code in this repo, then run `npx tollgate-cli test`.",
      "",
    ].join("\n"),
  );
}

async function runStatus(): Promise<void> {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    process.stdout.write("Not linked: no .tollgate.json here or above. Run init.\n");
    return;
  }
  const config = loadConfig(root)!;
  if (config.error) {
    process.stdout.write(`.tollgate.json is invalid: ${config.error}\n`);
    process.exitCode = 1;
    return;
  }
  const token = loadToken(root);
  process.stdout.write(`Repo ${config.repo} at ${root}\nServer ${config.server}\n`);
  process.stdout.write(`Presets ${config.presets.map((p) => p.name).join(", ")}\n`);
  if (!token) {
    process.stdout.write("Token: missing on this machine (risky commands will be blocked).\n");
    process.exitCode = 1;
    return;
  }
  try {
    const who = await whoAmI(config.server, token);
    process.stdout.write(
      `Token ${token.slice(0, 10)}… OK: team "${who.team.name}", ${who.repo.mode} mode\n`,
    );
  } catch (error) {
    process.stdout.write(`Token check failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

async function runTest(): Promise<void> {
  const root = findRepoRoot(process.cwd());
  const config = root ? loadConfig(root) : null;
  if (!config || config.error) throw new Error("Not linked. Run init first.");
  if (!config.presets.some((preset) => preset.name === "tollgate-test")) {
    config.presets = [DEFAULT_PRESETS[0]!, ...config.presets];
  }
  process.stdout.write(
    "Raising a test gate for `echo tollgate-test`. Approve or deny it in the room…\n",
  );
  const decision = await decide(
    { tool_name: "Bash", tool_input: { command: "echo tollgate-test" }, cwd: config.repoRoot },
    { ...hookDeps(), loadConfig: () => config },
  );
  const text =
    decision.kind === "deny"
      ? `Blocked: ${decision.reason}`
      : decision.kind === "allow"
        ? `Allowed: ${decision.reason}`
        : `Approved (${decision.note ?? "no decision"}): Claude Code's normal permission flow would run next.`;
  process.stdout.write(`${text}\n`);
}

function runUnlink(): void {
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  process.stdout.write(
    removeToken(root)
      ? "Token removed from this machine. Revoke it on the server too (Settings › Repos).\n"
      : "No token stored for this repo.\n",
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "hook":
      return runHook();
    case "init":
      return runInit(rest);
    case "status":
      return runStatus();
    case "test":
      return runTest();
    case "unlink":
      return runUnlink();
    case "--version":
    case "-v":
      process.stdout.write(`${TOLLGATE_VERSION}\n`);
      return;
    default:
      process.stdout.write(HELP);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`tollgate: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
