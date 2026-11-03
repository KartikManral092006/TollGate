import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { DEFAULT_PRESETS, presetListSchema } from "../../../features/gates/shared/presets";
import type { RepoConfig } from "./hook";

export const CONFIG_FILE = ".tollgate.json";
export const DEFAULT_HOOK_TIMEOUT_SEC = 300;

const configSchema = z.object({
  server: z.url({ protocol: /^https?$/ }),
  repo: z.string().min(1).max(200),
  presets: presetListSchema.optional(),
  hookTimeoutSec: z.number().int().min(30).max(600).optional(),
});

export type ConfigFile = z.infer<typeof configSchema>;

export function tollgateHome(env: Record<string, string | undefined> = process.env): string {
  return env.TOLLGATE_HOME || join(homedir(), ".config", "tollgate");
}

// The nearest .tollgate.json walking up from cwd marks the repo root.
export function findRepoRoot(cwd: string): string | null {
  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// The scripts of the nearest package.json between `cwd` and the repo root, so the hook can
// see what "pnpm db:deploy" really runs. Never looks above the repo.
export function readScripts(cwd: string, repoRoot: string): Record<string, string> | null {
  let dir = cwd;
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      try {
        const scripts = (JSON.parse(readFileSync(file, "utf8")) as { scripts?: unknown }).scripts;
        if (!scripts || typeof scripts !== "object") return null;
        return Object.fromEntries(
          Object.entries(scripts).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (dir === repoRoot || parent === dir || !dir.startsWith(repoRoot)) return null;
    dir = parent;
  }
}

export function readConfigFile(repoRoot: string): ConfigFile {
  const raw = JSON.parse(readFileSync(join(repoRoot, CONFIG_FILE), "utf8")) as unknown;
  return configSchema.parse(raw);
}

// A broken .tollgate.json must not silently disable gating: it comes back with the default
// presets and an error, so risky commands are blocked with a clear message.
export function loadConfig(cwd: string): RepoConfig | null {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) return null;
  let file: ConfigFile;
  try {
    file = readConfigFile(repoRoot);
  } catch (error) {
    return {
      repoRoot,
      server: "",
      repo: "",
      presets: DEFAULT_PRESETS,
      hookTimeoutSec: DEFAULT_HOOK_TIMEOUT_SEC,
      error: error instanceof SyntaxError ? "not valid JSON" : "unexpected fields",
    };
  }
  return {
    repoRoot,
    server: file.server.replace(/\/+$/, ""),
    repo: file.repo,
    presets: file.presets ?? DEFAULT_PRESETS,
    hookTimeoutSec: file.hookTimeoutSec ?? DEFAULT_HOOK_TIMEOUT_SEC,
  };
}

type TokenStore = Record<string, { token: string; server: string; repo: string }>;

function tokenFile(env?: Record<string, string | undefined>): string {
  return join(tollgateHome(env), "tokens.json");
}

function readStore(env?: Record<string, string | undefined>): TokenStore {
  try {
    return JSON.parse(readFileSync(tokenFile(env), "utf8")) as TokenStore;
  } catch {
    return {};
  }
}

// Tokens never live in the repo: an env override, else a 0600 file keyed by repo root.
export function loadToken(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.TOLLGATE_TOKEN) return env.TOLLGATE_TOKEN;
  return readStore(env)[repoRoot]?.token ?? null;
}

export function saveToken(
  repoRoot: string,
  entry: { token: string; server: string; repo: string },
  env: Record<string, string | undefined> = process.env,
): string {
  const file = tokenFile(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const store = readStore(env);
  store[repoRoot] = entry;
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

export function removeToken(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const store = readStore(env);
  if (!store[repoRoot]) return false;
  delete store[repoRoot];
  writeFileSync(tokenFile(env), `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  return true;
}

// Values from .env* files, so a secret pasted into a command is hidden even if no pattern
// recognises it. .env.example and friends hold placeholders, not secrets.
export function envSecrets(repoRoot: string): string[] {
  let names: string[];
  try {
    names = readdirSync(repoRoot).filter(
      (name) => /^\.env(\..+)?$/.test(name) && !/\.(example|sample|template)$/.test(name),
    );
  } catch {
    return [];
  }
  const values: string[] = [];
  for (const name of names) {
    let text: string;
    try {
      text = readFileSync(join(repoRoot, name), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)\s*$/.exec(line);
      const value = match?.[1]?.replace(/^(['"])(.*)\1$/, "$2").trim();
      if (value && value.length >= 8) values.push(value);
    }
  }
  return values;
}

function git(repoRoot: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function gitBranch(repoRoot: string): string | null {
  return git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

// "owner/name" from the origin remote, for init's default.
export function gitRepoName(repoRoot: string): string | null {
  const url = git(repoRoot, ["remote", "get-url", "origin"]);
  const match = url ? /[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(url) : null;
  return match?.[1] ?? null;
}

function newestFile(dir: string, pick: (name: string) => boolean): string | null {
  try {
    const names = readdirSync(dir).filter(pick).sort();
    return names.at(-1) ?? null;
  } catch {
    return null;
  }
}

// What an approver needs to judge the command, at most ~2 KB: the newest migration's SQL
// for migrate commands, the last commit for everything else.
export function buildContext(command: string, repoRoot: string): string {
  const parts: string[] = [];
  if (/\bprisma\s+(migrate|db\s+push)\b/i.test(command)) {
    const dir = join(repoRoot, "prisma", "migrations");
    const newest = newestFile(dir, (name) => /^\d/.test(name));
    if (newest) {
      try {
        const sql = readFileSync(join(dir, newest, "migration.sql"), "utf8");
        parts.push(`Newest migration ${newest}:\n${sql.slice(0, 1600)}`);
      } catch {
        // no migration.sql in that folder
      }
    }
  } else if (/\bdrizzle-kit\b/i.test(command)) {
    const dir = join(repoRoot, "drizzle");
    const newest = newestFile(dir, (name) => name.endsWith(".sql"));
    if (newest) {
      try {
        parts.push(
          `Newest migration ${newest}:\n${readFileSync(join(dir, newest), "utf8").slice(0, 1600)}`,
        );
      } catch {
        // unreadable
      }
    }
  }
  const commit = git(repoRoot, ["log", "-1", "--format=%h %s"]);
  if (commit) parts.push(`Last commit: ${commit}`);
  return parts.join("\n\n");
}
