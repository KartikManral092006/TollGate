import { z } from "zod";
import { expandCommand, type ScriptReader, type Segment } from "./expand";

// Shared by the server and the CLI hook (bundled into packages/cli), so: no "@/" imports,
// no server-only code. Patterns are regex sources, matched case-insensitively.

export type GateEnv = "prod" | "staging" | "other";

// What a gate stops: a Bash command, a file edit (Edit, Write, MultiEdit, NotebookEdit), or an
// MCP tool call. A preset only ever matches its own kind, so a file pattern can't catch a
// command that happens to mention the same path.
export const GATE_TOOLS = ["bash", "edit", "mcp"] as const;
export type GateTool = (typeof GATE_TOOLS)[number];

// How messages to agents and approvers name each kind.
export const TOOL_NOUN: Record<GateTool, string> = {
  bash: "command",
  edit: "edit",
  mcp: "tool call",
};

export const presetSchema = z.object({
  // Defaults to "bash", so presets written before file and MCP gates keep their meaning.
  tool: z.enum(GATE_TOOLS).optional(),
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,39}$/)
    .min(1),
  patterns: z.array(z.string().min(1).max(300)).min(1).max(20),
  // A match is skipped when any of these also matches (e.g. --dry-run changes nothing).
  unless: z.array(z.string().min(1).max(300)).max(20).optional(),
  // Fixed env for the preset; when absent it is read from the command (--prod, production, …).
  env: z.enum(["prod", "staging", "other"]).optional(),
  quorum: z.number().int().min(1).max(9),
  // Quorum when the detected env is prod (defaults to `quorum`).
  prodQuorum: z.number().int().min(1).max(9).optional(),
  // Only matches when a target path leaves the repo (destructive-fs).
  outsideRepoOnly: z.boolean().optional(),
});

export type Preset = z.infer<typeof presetSchema>;

export const presetListSchema = z.array(presetSchema).min(1).max(30);

// Found in the CLI end-to-end test: an agent told "dry-run first" got its dry run gated too.
const DRY_RUN = "(^|\\s)--dry-?run(=(true|client|server))?(\\s|$)";

// Order matters: the first matching preset wins, so narrower presets come first.
export const DEFAULT_PRESETS: Preset[] = [
  {
    name: "tollgate-test",
    patterns: ["^\\s*echo\\s+tollgate-test\\s*$"],
    env: "other",
    quorum: 1,
  },
  {
    name: "staging-deploy",
    patterns: [
      "\\bfly(ctl)?\\s+deploy\\b.*\\s(-a|--app)[ =]?\\S*-staging\\b",
      "\\brailway\\s+up\\b.*--environment[ =]staging\\b",
      "(^|[;&|]\\s*)vercel(\\s+deploy)?\\s*($|[;&|])",
    ],
    unless: [DRY_RUN],
    env: "staging",
    quorum: 1,
  },
  {
    name: "prod-deploy",
    patterns: [
      "\\bvercel\\b.*\\s--prod\\b",
      "\\bfly(ctl)?\\s+deploy\\b",
      "\\brailway\\s+up\\b.*--environment[ =]production\\b",
    ],
    unless: [DRY_RUN],
    env: "prod",
    quorum: 2,
  },
  {
    name: "db-migrate",
    patterns: [
      "\\bprisma\\s+migrate\\s+(deploy|reset)\\b",
      "\\bprisma\\s+db\\s+push\\b",
      "\\bdrizzle-kit\\s+(push|migrate)\\b",
      "\\bpsql\\b.*\\b(drop|alter|delete|truncate)\\b",
    ],
    quorum: 1,
    prodQuorum: 2,
  },
  {
    name: "publish",
    patterns: [
      // Flags (and their values) may sit between the tool and "publish": pnpm --filter cli publish.
      "\\b(npm|pnpm|yarn)\\b[^;&|\\n]*\\s+publish(\\s|$)",
      "\\bcargo\\s+publish\\b",
      "\\btwine\\s+upload\\b",
    ],
    unless: [DRY_RUN],
    env: "prod",
    quorum: 1,
  },
  {
    name: "infra",
    patterns: [
      "\\bterraform\\b[^;&|\\n]*\\s+(apply|destroy)(\\s|$)",
      "\\bpulumi\\b[^;&|\\n]*\\s+(up|destroy)(\\s|$)",
      "\\baws\\s+.*\\bdelete-[a-z-]+\\b",
      "\\baws\\s+s3\\s+(rm|rb)\\b",
      "\\bgcloud\\s+.*\\bdelete\\b",
    ],
    unless: [DRY_RUN],
    quorum: 2,
  },
  {
    // Code Tollgate can't read before it runs: fetched from the network, decoded, or built
    // from a variable at run time. A person should look before it runs.
    name: "opaque",
    patterns: [
      "\\b(curl|wget)\\b[^|;&]*\\|\\s*(sudo(\\s+-\\S+)*\\s+)?(env\\s+)?(ba|z|da|k)?sh\\b",
      "\\bbase64\\s+(-d|-D|--decode)\\b[^|;&]*\\|\\s*(sudo\\s+)?(ba|z|da|k)?sh\\b",
      "\\b(ba|z|da|k)?sh\\s+<\\(",
      "(^|[\\s;&|])(source|\\.)\\s+<\\(",
      "(^|[\\s;&|])eval\\s+[\"']?[$`]",
      "\\b(ba|z|da|k)?sh(\\s+-\\w+)*\\s+-\\w*c\\s+[\"']?[$`]",
    ],
    env: "other",
    quorum: 1,
  },
  {
    name: "destructive-fs",
    patterns: [
      "\\brm\\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|-r\\s+-f|-f\\s+-r|--recursive\\s+--force|--force\\s+--recursive)\\b",
    ],
    env: "other",
    quorum: 1,
    outsideRepoOnly: true,
  },
  // File edits are matched as "edit <path>" or "write <path>", the path relative to the repo
  // (or ~/… outside it).
  {
    // An agent that may not run a command could otherwise switch the guard off: the hook's
    // registration, the repo's presets, or this machine's Tollgate token.
    name: "guard-config",
    tool: "edit",
    patterns: [
      "(^|[\\s/])\\.claude/settings(\\.local)?\\.json$",
      "(^|[\\s/])\\.tollgate\\.json$",
      "(^|[\\s/])\\.config/tollgate/",
    ],
    env: "other",
    quorum: 1,
  },
  {
    // Where a deploy is defined: a change here ships with the next push, gate or not.
    name: "ci-config",
    tool: "edit",
    patterns: [
      "(^|[\\s/])\\.github/workflows/",
      "(^|[\\s/])\\.gitlab-ci\\.ya?ml$",
      "(^|[\\s/])(vercel|netlify)\\.(json|toml)$",
      "(^|[\\s/])(fly|railway)\\.(json|toml)$",
    ],
    quorum: 1,
    prodQuorum: 2,
  },
  {
    name: "env-file",
    tool: "edit",
    patterns: ["(^|[\\s/])\\.env(\\.[^/\\s]+)?$"],
    unless: ["\\.env\\.(example|sample|template|defaults)$"],
    quorum: 1,
  },
  {
    // MCP calls are matched as "mcp__server__tool {json args}". Tool names that move money,
    // ship, merge or destroy, whichever server they come from.
    name: "mcp-risky",
    tool: "mcp",
    patterns: [
      "^mcp__\\S+?__(\\S*_)?(delete|drop|destroy|deploy|publish|merge|refund|charge|payout|transfer|execute_sql|apply_migration)(_\\S*)?(\\s|$)",
    ],
    quorum: 1,
    prodQuorum: 2,
  },
];

const PROD_RE = /(^|[\s=:/_-])(prod|production)($|[\s.:/_-])|--prod\b/i;
const STAGING_RE = /(^|[\s=:/_-])(staging|stg)($|[\s.:/_-])/i;

export function detectEnv(command: string): GateEnv {
  if (PROD_RE.test(command)) return "prod";
  if (STAGING_RE.test(command)) return "staging";
  return "other";
}

const regexCache = new Map<string, RegExp | null>();

function compile(source: string): RegExp | null {
  if (!regexCache.has(source)) {
    try {
      regexCache.set(source, new RegExp(source, "i"));
    } catch {
      regexCache.set(source, null);
    }
  }
  return regexCache.get(source) ?? null;
}

// POSIX-style resolution without node:path, so this file also runs in the browser bundle.
function resolvePath(base: string, target: string): string {
  const parts = (target.startsWith("/") ? target : `${base}/${target}`).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

// Targets of an `rm -rf …` segment that leave repoRoot, or can't be resolved safely ($VAR,
// ~, globs at the root). Unknown means "outside": a gate is cheaper than a lost home dir.
export function rmTargetsOutsideRepo(command: string, cwd: string, repoRoot: string): boolean {
  const root = resolvePath("/", repoRoot);
  for (const segment of command.split(/&&|\|\||;|\|/)) {
    const words = segment.trim().split(/\s+/);
    const rmAt = words.findIndex((word) => word === "rm" || word.endsWith("/rm"));
    if (rmAt === -1) continue;
    for (const word of words.slice(rmAt + 1)) {
      if (word.startsWith("-")) continue;
      const target = word.replace(/^['"]|['"]$/g, "");
      if (/[$~`]/.test(target) || target === "*" || target === "/*") return true;
      const resolved = resolvePath(cwd, target);
      if (resolved !== root && !resolved.startsWith(`${root}/`)) return true;
      if (resolved === root) return true;
    }
  }
  return false;
}

export type PresetMatch = { preset: Preset; env: GateEnv; quorum: number };

// File names use dots where commands use dashes (".env.production", "deploy.prod.yml"), and
// MCP arguments are JSON ({"environment":"production"}).
function envOf(tool: GateTool, text: string): GateEnv {
  if (tool === "edit") return detectEnv(text.replace(/\./g, "/"));
  if (tool === "mcp") return detectEnv(text.replace(/["{},]/g, " "));
  return detectEnv(text);
}

export function matchPreset(
  presets: Preset[],
  input: { command: string; cwd: string; repoRoot: string; tool?: GateTool },
): PresetMatch | null {
  const tool = input.tool ?? "bash";
  for (const preset of presets) {
    if ((preset.tool ?? "bash") !== tool) continue;
    const hit = preset.patterns.some((source) => compile(source)?.test(input.command) ?? false);
    if (!hit) continue;
    if (preset.unless?.some((source) => compile(source)?.test(input.command) ?? false)) continue;
    if (preset.outsideRepoOnly && !rmTargetsOutsideRepo(input.command, input.cwd, input.repoRoot)) {
      continue;
    }
    const env = preset.env ?? envOf(tool, input.command);
    const quorum = env === "prod" ? Math.max(preset.quorum, preset.prodQuorum ?? 0) : preset.quorum;
    return { preset, env, quorum };
  }
  return null;
}

// A local .tollgate.json can add presets and patterns but never lose the built-in ones:
// missing presets are appended, and a same-named preset also gets the built-in patterns.
export function withDefaultPresets(presets: Preset[]): Preset[] {
  const defaults = new Map(DEFAULT_PRESETS.map((preset) => [preset.name, preset]));
  const names = new Set(presets.map((preset) => preset.name));
  const merged = presets.map((preset) => {
    const builtIn = defaults.get(preset.name);
    // The built-in kind wins too: a local file can't move prod-deploy off Bash commands.
    return builtIn
      ? {
          ...preset,
          tool: builtIn.tool,
          patterns: [...new Set([...preset.patterns, ...builtIn.patterns])],
        }
      : preset;
  });
  return [...merged, ...DEFAULT_PRESETS.filter((preset) => !names.has(preset.name))];
}

export type CommandMatch = PresetMatch & {
  // The piece that matched, and how it was reached ("pnpm db:deploy" for a package script).
  segment: string;
  via: string[];
};

const ENV_RANK: Record<GateEnv, number> = { prod: 2, staging: 1, other: 0 };

// Matches every piece of a command (see expand.ts), each with its own `unless`, and keeps the
// strongest match: highest quorum, then production, then the first found. The raw command is
// matched too, so nothing the expander mis-reads is lost. `extra` adds pieces the caller
// already knows about (the server re-checks what the hook reported a script runs).
export function matchCommand(
  presets: Preset[],
  input: {
    command: string;
    cwd: string;
    repoRoot: string;
    tool?: GateTool;
    readScripts?: ScriptReader;
    extra?: Segment[];
  },
): CommandMatch | null {
  const tool = input.tool ?? "bash";
  // Only shell commands have pieces, wrappers and package scripts to see through.
  const pieces: Segment[] =
    tool === "bash"
      ? [
          { text: input.command, via: [] },
          ...expandCommand(input.command, { cwd: input.cwd, readScripts: input.readScripts }),
          ...(input.extra ?? []),
        ]
      : [{ text: input.command, via: [] }];
  let best: CommandMatch | null = null;
  for (const piece of pieces) {
    const match = matchPreset(presets, {
      command: piece.text,
      cwd: input.cwd,
      repoRoot: input.repoRoot,
      tool,
    });
    if (!match) continue;
    const better =
      best === null ||
      match.quorum > best.quorum ||
      (match.quorum === best.quorum && ENV_RANK[match.env] > ENV_RANK[best.env]) ||
      (match.quorum === best.quorum &&
        match.env === best.env &&
        best.via.length === 0 &&
        piece.via.length > 0 &&
        best.preset.name === match.preset.name);
    if (better) best = { ...match, segment: piece.text, via: piece.via };
  }
  return best;
}

// The server is authoritative: a local .tollgate.json can add presets but never lower a
// quorum. The server re-matches the (redacted) command against its own list.
export function authoritativeQuorum(
  serverMatch: PresetMatch | null,
  clientQuorum: number | undefined,
): number {
  return Math.max(serverMatch?.quorum ?? 1, clientQuorum ?? 1, 1);
}
