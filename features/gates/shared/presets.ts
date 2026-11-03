import { z } from "zod";

// Shared by the server and the CLI hook (bundled into packages/cli), so: no "@/" imports,
// no server-only code. Patterns are regex sources, matched case-insensitively.

export type GateEnv = "prod" | "staging" | "other";

export const presetSchema = z.object({
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
      "\\b(npm|pnpm|yarn)\\s+publish\\b",
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
      "\\bterraform\\s+(apply|destroy)\\b",
      "\\bpulumi\\s+(up|destroy)\\b",
      "\\baws\\s+.*\\bdelete-[a-z-]+\\b",
      "\\baws\\s+s3\\s+(rm|rb)\\b",
      "\\bgcloud\\s+.*\\bdelete\\b",
    ],
    unless: [DRY_RUN],
    quorum: 2,
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

export function matchPreset(
  presets: Preset[],
  input: { command: string; cwd: string; repoRoot: string },
): PresetMatch | null {
  for (const preset of presets) {
    const hit = preset.patterns.some((source) => compile(source)?.test(input.command) ?? false);
    if (!hit) continue;
    if (preset.unless?.some((source) => compile(source)?.test(input.command) ?? false)) continue;
    if (preset.outsideRepoOnly && !rmTargetsOutsideRepo(input.command, input.cwd, input.repoRoot)) {
      continue;
    }
    const env = preset.env ?? detectEnv(input.command);
    const quorum = env === "prod" ? Math.max(preset.quorum, preset.prodQuorum ?? 0) : preset.quorum;
    return { preset, env, quorum };
  }
  return null;
}

// The server is authoritative: a local .tollgate.json can add presets but never lower a
// quorum. The server re-matches the (redacted) command against its own list.
export function authoritativeQuorum(
  serverMatch: PresetMatch | null,
  clientQuorum: number | undefined,
): number {
  return Math.max(serverMatch?.quorum ?? 1, clientQuorum ?? 1, 1);
}
