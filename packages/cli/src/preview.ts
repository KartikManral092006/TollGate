import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

// What a gated command will actually do, found on the developer's machine with read-only
// checks only: git queries, reading files, counting files, `prisma migrate status`,
// `terraform plan -lock=false` / `terraform show`. Nothing here changes anything. Every check
// has a time limit, and a check that fails just leaves its line out. Shown on the card as
// "What it will do"; the first line is the headline.

export const PREVIEW_MAX = 2000;
// Previews run while the gate already waits; skipped when the hook has less time than this.
export const PREVIEW_MIN_TIME_MS = 30_000;
const WALK_LIMIT = 20_000;

export type ExecResult = { ok: boolean; stdout: string; timedOut: boolean };

export type PreviewDeps = {
  // Runs a program without a shell. Non-zero exits still return their stdout.
  exec(file: string, args: string[], options: { cwd: string; timeoutMs: number }): ExecResult;
  readFile(path: string): string | null;
  // Files under a path (a file counts as one), stopping at `limit`.
  countFiles(path: string, limit: number): { exists: boolean; files: number; capped: boolean };
  exists(path: string): boolean;
  home: string;
  now(): number;
};

export type PreviewInput = {
  preset: string;
  // The risky part of the command, as matched (wrappers and package scripts expanded).
  segment: string;
  cwd: string;
  repoRoot: string;
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// Shell-like words: quotes kept together, no expansion. Enough for the commands agents type.
export function words(command: string): string[] {
  const out: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(command))) out.push(match[1] ?? match[2] ?? match[3] ?? "");
  return out;
}

function git(deps: PreviewDeps, repoRoot: string, args: string[]): string | null {
  const result = deps.exec("git", args, { cwd: repoRoot, timeoutMs: 2000 });
  return result.ok ? result.stdout.trim() : null;
}

// Deploys build from this machine: which commit, and what isn't committed or pushed.
export function deployPreview(input: PreviewInput, deps: PreviewDeps): string | null {
  const commit = git(deps, input.repoRoot, ["log", "-1", "--format=%h %s"]);
  if (commit === null) return null;
  const branch = git(deps, input.repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = git(deps, input.repoRoot, ["status", "--porcelain"]);
  const dirty = status ? status.split("\n").filter(Boolean).length : 0;
  const unpushed = git(deps, input.repoRoot, ["rev-list", "--count", "@{u}..HEAD"]);
  const [hash, ...subject] = commit.split(" ");
  const lines = [
    `Deploys ${branch && branch !== "HEAD" ? `${branch} at ` : ""}${hash} "${subject.join(" ")}"`,
  ];
  if (dirty > 0) lines.push(`${plural(dirty, "uncommitted change")} will go out with it`);
  if (unpushed === null) lines.push("This branch isn't pushed anywhere");
  else if (Number(unpushed) > 0)
    lines.push(`${plural(Number(unpushed), "commit")} not pushed yet: nobody has reviewed them`);
  if (dirty === 0 && unpushed !== null && Number(unpushed) === 0) {
    lines.push("Working tree clean and everything is pushed");
  }
  return lines.join("\n");
}

function readJson(deps: PreviewDeps, path: string): Record<string, unknown> | null {
  const text = deps.readFile(path);
  if (text === null) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function publishPreview(input: PreviewInput, deps: PreviewDeps): string | null {
  const argv = words(input.segment);
  const status = git(deps, input.repoRoot, ["status", "--porcelain"]);
  const dirty = status ? status.split("\n").filter(Boolean).length : 0;
  const dirtyLine =
    dirty > 0 ? `${plural(dirty, "uncommitted change")} in the repo (published as is)` : null;

  if (argv.includes("cargo")) {
    const toml = deps.readFile(join(input.cwd, "Cargo.toml"));
    const name = toml && /^\s*name\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    const version = toml && /^\s*version\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    if (!name || !version) return null;
    return [`Publishes ${name}@${version} to crates.io (versions can't be deleted)`, dirtyLine]
      .filter(Boolean)
      .join("\n");
  }
  if (argv.includes("twine")) {
    const files = argv.slice(argv.indexOf("upload") + 1).filter((word) => !word.startsWith("-"));
    if (files.length === 0) return null;
    return [`Uploads to PyPI: ${files.join(", ")}`, dirtyLine].filter(Boolean).join("\n");
  }

  // npm, pnpm, yarn: a path argument after "publish" names the package folder.
  const after = argv.slice(argv.indexOf("publish") + 1);
  const folder = after.find(
    (word) => !word.startsWith("-") && deps.exists(resolve(input.cwd, word)),
  );
  const dir = folder ? resolve(input.cwd, folder) : input.cwd;
  const pkg = readJson(deps, join(dir, "package.json"));
  if (!pkg || typeof pkg.name !== "string" || typeof pkg.version !== "string") return null;
  const access =
    after.includes("public") ||
    (pkg.publishConfig as { access?: string } | undefined)?.access === "public"
      ? "publicly"
      : pkg.name.startsWith("@")
        ? "to its scope (restricted unless --access public)"
        : "publicly";
  const lines = [`Publishes ${pkg.name}@${pkg.version} ${access}`];
  if (pkg.private === true) lines.push(`package.json says "private": true, so npm will refuse`);
  const tagNames = [`v${pkg.version}`, `${pkg.name}@${pkg.version}`];
  const tags = git(deps, input.repoRoot, ["tag", "-l", ...tagNames]);
  if (tags !== null && !tags.trim()) lines.push(`No git tag ${tagNames[0]} yet`);
  if (dirtyLine) lines.push(dirtyLine);
  return lines.join("\n");
}

// Where a path is, for the card: repo-relative, ~/…, or absolute.
function shown(path: string, repoRoot: string, home: string): { label: string; inRepo: boolean } {
  const rel = relative(repoRoot, path);
  if (rel === "") return { label: "the repo itself", inRepo: true };
  if (!rel.startsWith("..") && !isAbsolute(rel))
    return { label: rel.split(sep).join("/"), inRepo: true };
  const inHome = relative(home, path);
  if (inHome && !inHome.startsWith("..") && !isAbsolute(inHome)) {
    return { label: `~/${inHome.split(sep).join("/")}`, inRepo: false };
  }
  return { label: path, inRepo: false };
}

export function removePreview(input: PreviewInput, deps: PreviewDeps): string | null {
  const argv = words(input.segment);
  const start = argv.findIndex((word) => word === "rm" || word.endsWith("/rm"));
  if (start < 0) return null;
  let options = true;
  const targets: string[] = [];
  for (const word of argv.slice(start + 1)) {
    if (/^[;&|]/.test(word)) break;
    if (options && word === "--") {
      options = false;
      continue;
    }
    if (options && word.startsWith("-")) continue;
    targets.push(word);
  }
  if (targets.length === 0) return null;

  let total = 0;
  let capped = false;
  const lines: string[] = [];
  for (const target of targets.slice(0, 8)) {
    if (/[*?[{$`]/.test(target)) {
      lines.push(`${target}: a pattern the shell expands, not counted`);
      continue;
    }
    const path =
      target === "~" || target.startsWith("~/")
        ? join(deps.home, target.slice(1))
        : resolve(input.cwd, target);
    const where = shown(path, input.repoRoot, deps.home);
    const count = deps.countFiles(path, WALK_LIMIT);
    if (!count.exists) {
      lines.push(`${where.label}: doesn't exist`);
      continue;
    }
    total += count.files;
    capped ||= count.capped;
    let tracked = "";
    if (where.inRepo) {
      const files = git(deps, input.repoRoot, ["ls-files", "--", path]);
      const n = files ? files.split("\n").filter(Boolean).length : 0;
      tracked = n > 0 ? `, ${plural(n, "file")} tracked by git` : ", none tracked by git";
    }
    lines.push(
      `${where.label}: ${count.capped ? "more than " : ""}${plural(count.files, "file")}${tracked}${where.inRepo ? "" : ", outside the repo"}`,
    );
  }
  if (targets.length > 8) lines.push(`…and ${targets.length - 8} more paths`);
  const headline =
    total === 0
      ? "Deletes nothing that exists right now"
      : `Deletes ${capped ? "more than " : ""}${plural(total, "file")} for good (rm doesn't use the trash)`;
  return [headline, ...lines].join("\n");
}

function prismaBin(deps: PreviewDeps, repoRoot: string, cwd: string): string | null {
  for (const dir of [cwd, repoRoot]) {
    const bin = join(dir, "node_modules", ".bin", "prisma");
    if (deps.exists(bin)) return bin;
  }
  return null;
}

export function migratePreview(input: PreviewInput, deps: PreviewDeps): string | null {
  if (/\bprisma\s+migrate\s+reset\b/.test(input.segment)) {
    return "Drops the database and recreates it: every row in it is deleted";
  }
  if (!/\bprisma\s+migrate\s+deploy\b/.test(input.segment)) return null;
  const bin = prismaBin(deps, input.repoRoot, input.cwd);
  if (!bin) return null;
  const schema = /--schema[ =](\S+)/.exec(input.segment)?.[1];
  const result = deps.exec(bin, ["migrate", "status", ...(schema ? ["--schema", schema] : [])], {
    cwd: input.cwd,
    timeoutMs: 15_000,
  });
  const out = result.stdout;
  if (/Database schema is up to date/i.test(out)) {
    return "No migrations are waiting: the database is already up to date";
  }
  const pending = /have not yet been applied:\s*\n([\s\S]*?)(\n\s*\n|$)/i.exec(out)?.[1];
  if (pending) {
    const names = pending
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return [`Applies ${plural(names.length, "migration")} to the database:`, ...names].join("\n");
  }
  return result.timedOut ? "Couldn't check pending migrations in time" : null;
}

const PLAN_LINE = /^Plan: (\d+) to add, (\d+) to change, (\d+) to destroy\./m;
const RESOURCE_LINE =
  /^\s*# (\S+) (will be destroyed|must be replaced|will be created|will be updated in-place|will be read during apply)/;

export function summarizePlan(text: string): string | null {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (/No changes\./.test(clean)) return "Terraform plan: no changes to make";
  const plan = PLAN_LINE.exec(clean);
  if (!plan) return null;
  const [, add, change, destroy] = plan;
  const resources = clean
    .split("\n")
    .map((line) => RESOURCE_LINE.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ address: match[1]!, action: match[2]! }));
  // What can't be undone first.
  const rank = (action: string) =>
    action === "will be destroyed" ? 0 : action === "must be replaced" ? 1 : 2;
  resources.sort((a, b) => rank(a.action) - rank(b.action));
  const lines = [
    `Terraform plan: ${add} to add, ${change} to change, ${destroy} to destroy`,
    ...resources.slice(0, 12).map((r) => `${r.address} ${r.action}`),
  ];
  if (resources.length > 12) lines.push(`…and ${resources.length - 12} more`);
  return lines.join("\n");
}

export function terraformPreview(input: PreviewInput, deps: PreviewDeps): string | null {
  if (!/\bterraform\b/.test(input.segment)) return null;
  const argv = words(input.segment);
  const at = argv.findIndex((word) => word === "apply" || word === "destroy");
  if (at < 0) return null;
  const chdir = argv.find((word) => word.startsWith("-chdir="))?.slice("-chdir=".length);
  const dir = chdir ? resolve(input.cwd, chdir) : input.cwd;
  // A saved plan file is exactly what will run.
  const planFile = argv
    .slice(at + 1)
    .find((word) => !word.startsWith("-") && deps.exists(resolve(dir, word)));
  if (planFile) {
    const shownPlan = deps.exec("terraform", ["show", "-no-color", planFile], {
      cwd: dir,
      timeoutMs: 10_000,
    });
    return summarizePlan(shownPlan.stdout);
  }
  // Same variables and targets as the command; -lock=false so the check never holds the state.
  const passThrough = argv
    .slice(at + 1)
    .filter((word) => /^-(var|var-file|target|replace)=/.test(word));
  const planned = deps.exec(
    "terraform",
    [
      "plan",
      "-input=false",
      "-lock=false",
      "-no-color",
      ...(argv[at] === "destroy" ? ["-destroy"] : []),
      ...passThrough,
    ],
    { cwd: dir, timeoutMs: 20_000 },
  );
  if (planned.timedOut)
    return "terraform plan didn't finish in 20 s; check the plan before approving";
  return summarizePlan(planned.stdout);
}

const BY_PRESET: Record<string, (input: PreviewInput, deps: PreviewDeps) => string | null> = {
  "staging-deploy": deployPreview,
  "prod-deploy": deployPreview,
  publish: publishPreview,
  "destructive-fs": removePreview,
  "db-migrate": migratePreview,
  infra: terraformPreview,
};

// The preview for a gate, or null when there's nothing useful to say. Never throws.
export function buildPreview(input: PreviewInput, deps: PreviewDeps): string | null {
  const preview = BY_PRESET[input.preset];
  if (!preview) return null;
  try {
    const text = preview(input, deps)?.trim();
    if (!text) return null;
    return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
  } catch {
    return null;
  }
}

// The real machine.
export function systemPreviewDeps(home: string): PreviewDeps {
  return {
    exec(file, args, options) {
      try {
        const stdout = execFileSync(file, args, {
          cwd: options.cwd,
          encoding: "utf8",
          timeout: options.timeoutMs,
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env, TF_IN_AUTOMATION: "1", NO_COLOR: "1" },
        });
        return { ok: true, stdout, timedOut: false };
      } catch (error) {
        const failed = error as { stdout?: string; signal?: string; code?: string };
        return {
          ok: false,
          stdout: typeof failed.stdout === "string" ? failed.stdout : "",
          timedOut: failed.signal === "SIGTERM" || failed.code === "ETIMEDOUT",
        };
      }
    },
    readFile(path) {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
    countFiles(path, limit) {
      let stat;
      try {
        stat = lstatSync(path);
      } catch {
        return { exists: false, files: 0, capped: false };
      }
      if (!stat.isDirectory()) return { exists: true, files: 1, capped: false };
      let files = 0;
      const stack = [path];
      while (stack.length > 0) {
        const dir = stack.pop()!;
        let entries;
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          // Symlinked folders aren't followed: rm -r removes the link, not what it points to.
          if (entry.isDirectory()) stack.push(join(dir, entry.name));
          else files += 1;
          if (files >= limit) return { exists: true, files, capped: true };
        }
      }
      return { exists: true, files, capped: false };
    },
    exists: (path) => existsSync(path),
    home,
    now: () => Date.now(),
  };
}
