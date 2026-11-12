import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESETS } from "@/features/gates/shared/presets";
import type { HookGateStatus } from "@/features/gates/shared/hook-api";
import { decide, type HookApi, type HookDeps } from "@/packages/cli/src/hook";
import {
  buildPreview,
  summarizePlan,
  systemPreviewDeps,
  words,
  type ExecResult,
  type PreviewDeps,
} from "@/packages/cli/src/preview";

type Call = { file: string; args: string[]; cwd: string };

// A fake machine: git answers from a table, files from a map.
function fake(options: {
  git?: Record<string, string | null>;
  files?: Record<string, string>;
  exec?: (call: Call) => ExecResult | undefined;
  counts?: Record<string, { files: number; capped?: boolean }>;
}) {
  const calls: Call[] = [];
  const deps: PreviewDeps = {
    exec(file, args, { cwd }) {
      calls.push({ file, args, cwd });
      const custom = options.exec?.({ file, args, cwd });
      if (custom) return custom;
      if (file === "git") {
        const answer = options.git?.[args.join(" ")];
        return answer === undefined || answer === null
          ? { ok: false, stdout: "", timedOut: false }
          : { ok: true, stdout: answer, timedOut: false };
      }
      return { ok: false, stdout: "", timedOut: false };
    },
    readFile: (path) => options.files?.[path] ?? null,
    countFiles: (path) => {
      const count = options.counts?.[path];
      return count
        ? { exists: true, files: count.files, capped: count.capped ?? false }
        : { exists: false, files: 0, capped: false };
    },
    exists: (path) => path in (options.files ?? {}) || path in (options.counts ?? {}),
    home: "/home/dev",
    now: () => 0,
  };
  return { deps, calls };
}

const at = { cwd: "/w/acme", repoRoot: "/w/acme" };

describe("what a deploy will ship", () => {
  it("names the commit and warns about uncommitted and unpushed work", () => {
    const { deps } = fake({
      git: {
        "log -1 --format=%h %s": "3f2a1c9 Fix invoice rounding",
        "rev-parse --abbrev-ref HEAD": "main",
        "status --porcelain": " M billing/totals.ts\n?? scratch.txt\n",
        "rev-list --count @{u}..HEAD": "2",
      },
    });
    expect(buildPreview({ ...at, preset: "prod-deploy", segment: "vercel --prod" }, deps)).toBe(
      [
        'Deploys main at 3f2a1c9 "Fix invoice rounding"',
        "2 uncommitted changes will go out with it",
        "2 commits not pushed yet: nobody has reviewed them",
      ].join("\n"),
    );
  });

  it("says when everything is committed and pushed, or the branch has no upstream", () => {
    const clean = fake({
      git: {
        "log -1 --format=%h %s": "abc Ship",
        "rev-parse --abbrev-ref HEAD": "main",
        "status --porcelain": "",
        "rev-list --count @{u}..HEAD": "0",
      },
    });
    expect(
      buildPreview({ ...at, preset: "staging-deploy", segment: "fly deploy" }, clean.deps),
    ).toContain("Working tree clean and everything is pushed");
    const local = fake({
      git: { "log -1 --format=%h %s": "abc Ship", "status --porcelain": "" },
    });
    expect(
      buildPreview({ ...at, preset: "staging-deploy", segment: "fly deploy" }, local.deps),
    ).toContain("This branch isn't pushed anywhere");
  });
});

describe("what a publish will release", () => {
  it("reads the package, its access, a missing tag and private packages", () => {
    const { deps } = fake({
      files: {
        "/w/acme/package.json": JSON.stringify({ name: "@acme/sdk", version: "2.4.0" }),
      },
      git: { "status --porcelain": "", "tag -l v2.4.0 @acme/sdk@2.4.0": "" },
    });
    expect(
      buildPreview({ ...at, preset: "publish", segment: "pnpm publish --access public" }, deps),
    ).toBe("Publishes @acme/sdk@2.4.0 publicly\nNo git tag v2.4.0 yet");

    const priv = fake({
      files: {
        "/w/acme/package.json": JSON.stringify({ name: "x", version: "1.0.0", private: true }),
      },
      git: { "status --porcelain": " M a", "tag -l v1.0.0 x@1.0.0": "v1.0.0" },
    });
    expect(buildPreview({ ...at, preset: "publish", segment: "npm publish" }, priv.deps)).toBe(
      [
        "Publishes x@1.0.0 publicly",
        'package.json says "private": true, so npm will refuse',
        "1 uncommitted change in the repo (published as is)",
      ].join("\n"),
    );
  });

  it("reads Cargo.toml for cargo publish", () => {
    const { deps } = fake({
      files: { "/w/acme/Cargo.toml": '[package]\nname = "acme"\nversion = "0.3.1"\n' },
      git: { "status --porcelain": "" },
    });
    expect(buildPreview({ ...at, preset: "publish", segment: "cargo publish" }, deps)).toBe(
      "Publishes acme@0.3.1 to crates.io (versions can't be deleted)",
    );
  });
});

describe("what rm -rf will delete", () => {
  it("counts files per path, outside the repo and in it, and skips patterns", () => {
    const { deps } = fake({
      counts: {
        "/home/dev/old-project": { files: 1240 },
        "/w/acme/dist": { files: 30 },
      },
      git: { "ls-files -- /w/acme/dist": "dist/a.js\ndist/b.js\n" },
    });
    const preview = buildPreview(
      {
        ...at,
        preset: "destructive-fs",
        segment: "rm -rf ~/old-project dist /tmp/gone *.log",
      },
      deps,
    );
    expect(preview).toBe(
      [
        "Deletes 1,270 files for good (rm doesn't use the trash)",
        "~/old-project: 1,240 files, outside the repo",
        "dist: 30 files, 2 files tracked by git",
        "/tmp/gone: doesn't exist",
        "*.log: a pattern the shell expands, not counted",
      ].join("\n"),
    );
  });

  it("counts real folders without following symlinks, and stops at the cap", () => {
    const root = mkdtempSync(join(tmpdir(), "tollgate-preview-"));
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "a", "one"), "1");
    writeFileSync(join(root, "a", "b", "two"), "2");
    symlinkSync(tmpdir(), join(root, "a", "link"));
    const system = systemPreviewDeps("/home/dev");
    expect(system.countFiles(join(root, "a"), 100)).toEqual({
      exists: true,
      files: 3,
      capped: false,
    });
    expect(system.countFiles(join(root, "a"), 2)).toMatchObject({ capped: true, files: 2 });
    expect(system.countFiles(join(root, "nope"), 100).exists).toBe(false);
  });
});

describe("what a migration will apply", () => {
  const bin = "/w/acme/node_modules/.bin/prisma";

  it("lists pending migrations from prisma migrate status", () => {
    const { deps, calls } = fake({
      files: { [bin]: "" },
      exec: ({ file }) =>
        file === bin
          ? {
              ok: false,
              timedOut: false,
              stdout:
                "3 migrations found in prisma/migrations\nFollowing migrations have not yet been applied:\n0015_gate_outcomes\n0016_agent_task\n\nTo apply migrations in development run prisma migrate dev.\n",
            }
          : undefined,
    });
    expect(
      buildPreview({ ...at, preset: "db-migrate", segment: "prisma migrate deploy" }, deps),
    ).toBe("Applies 2 migrations to the database:\n0015_gate_outcomes\n0016_agent_task");
    expect(calls[0]).toMatchObject({ file: bin, args: ["migrate", "status"] });
  });

  it("says when nothing is pending, and what a reset does", () => {
    const { deps } = fake({
      files: { [bin]: "" },
      exec: () => ({ ok: true, timedOut: false, stdout: "Database schema is up to date!" }),
    });
    expect(
      buildPreview({ ...at, preset: "db-migrate", segment: "prisma migrate deploy" }, deps),
    ).toBe("No migrations are waiting: the database is already up to date");
    expect(
      buildPreview({ ...at, preset: "db-migrate", segment: "prisma migrate reset --force" }, deps),
    ).toBe("Drops the database and recreates it: every row in it is deleted");
  });
});

const PLAN = `
Terraform will perform the following actions:

  # aws_s3_bucket.logs will be destroyed
  - resource "aws_s3_bucket" "logs" {
  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
  # aws_iam_role.ci will be created
  + resource "aws_iam_role" "ci" {

Plan: 2 to add, 0 to change, 2 to destroy.
`;

describe("what terraform will change", () => {
  it("summarises a plan, what can't be undone first", () => {
    expect(summarizePlan(PLAN)).toBe(
      [
        "Terraform plan: 2 to add, 0 to change, 2 to destroy",
        "aws_s3_bucket.logs will be destroyed",
        "aws_instance.web must be replaced",
        "aws_iam_role.ci will be created",
      ].join("\n"),
    );
    expect(summarizePlan("No changes. Your infrastructure matches the configuration.")).toBe(
      "Terraform plan: no changes to make",
    );
    expect(summarizePlan("Error: no credentials")).toBeNull();
  });

  it("plans without taking the state lock, with the command's own variables", () => {
    const { deps, calls } = fake({
      exec: ({ file }) =>
        file === "terraform" ? { ok: true, timedOut: false, stdout: PLAN } : undefined,
    });
    buildPreview(
      {
        ...at,
        preset: "infra",
        segment: "terraform apply -auto-approve -var=env=prod -target=aws_instance.web",
      },
      deps,
    );
    expect(calls[0]!.args).toEqual([
      "plan",
      "-input=false",
      "-lock=false",
      "-no-color",
      "-var=env=prod",
      "-target=aws_instance.web",
    ]);
    buildPreview({ ...at, preset: "infra", segment: "terraform destroy" }, deps);
    expect(calls[1]!.args).toContain("-destroy");
  });

  it("shows a saved plan file instead of planning again, and says when planning is slow", () => {
    const { deps, calls } = fake({
      files: { "/w/acme/release.tfplan": "" },
      exec: ({ file, args }) =>
        file === "terraform" && args[0] === "show"
          ? { ok: true, timedOut: false, stdout: PLAN }
          : undefined,
    });
    buildPreview({ ...at, preset: "infra", segment: "terraform apply release.tfplan" }, deps);
    expect(calls[0]!.args).toEqual(["show", "-no-color", "release.tfplan"]);

    const slow = fake({ exec: () => ({ ok: false, timedOut: true, stdout: "" }) });
    expect(buildPreview({ ...at, preset: "infra", segment: "terraform apply" }, slow.deps)).toBe(
      "terraform plan didn't finish in 20 s; check the plan before approving",
    );
  });
});

describe("previews in general", () => {
  it("say nothing for presets without a check, and never throw", () => {
    const { deps } = fake({});
    expect(buildPreview({ ...at, preset: "env-file", segment: "edit .env" }, deps)).toBeNull();
    const broken: PreviewDeps = {
      ...deps,
      exec: () => {
        throw new Error("boom");
      },
    };
    expect(
      buildPreview({ ...at, preset: "prod-deploy", segment: "vercel --prod" }, broken),
    ).toBeNull();
    expect(words(`a "b c" 'd e' f`)).toEqual(["a", "b c", "d e", "f"]);
  });
});

describe("attaching the preview to a gate", () => {
  const gate = (patch: Partial<HookGateStatus> = {}): HookGateStatus => ({
    id: "G".repeat(32),
    code: 7,
    status: "pending",
    quorum: 1,
    approvals: 0,
    denyReason: null,
    decidedBy: null,
    mode: "guard",
    url: "u",
    ...patch,
  });

  function setup(created: HookGateStatus, options: { previews?: boolean; timeout?: number } = {}) {
    let clock = 0;
    const api: HookApi = {
      consumeGrant: vi.fn(async () => ({ ok: false })),
      createGate: vi.fn(async () => created),
      getGate: vi.fn(async () => gate({ status: "approved" })),
      park: vi.fn(),
      reportOutcome: vi.fn(),
      reportBypass: vi.fn(),
      attachPreview: vi.fn(async () => ({})),
    };
    const deps: HookDeps = {
      loadConfig: () => ({
        repoRoot: "/w/acme",
        server: "https://t.test",
        repo: "acme/billing",
        presets: DEFAULT_PRESETS,
        hookTimeoutSec: options.timeout ?? 300,
        previews: options.previews,
      }),
      loadToken: () => "tg_token",
      api: () => api,
      envSecrets: () => ["supersecretvalue"],
      gitBranch: () => "main",
      context: () => "",
      env: {},
      home: "/home/dev",
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      audit: vi.fn(),
      progress: vi.fn(),
      newId: () => "B".repeat(32),
      preview: vi.fn(() => 'Deploys main at abc "token supersecretvalue"'),
    };
    return { api, deps };
  }

  const run = { tool_name: "Bash", tool_input: { command: "vercel --prod" }, cwd: "/w/acme" };

  it("posts it after the card is up, redacted", async () => {
    const { api, deps } = setup(gate({ previews: true }));
    await decide(run, deps);
    expect(deps.preview).toHaveBeenCalledWith({
      preset: "prod-deploy",
      segment: "vercel --prod",
      cwd: "/w/acme",
      repoRoot: "/w/acme",
    });
    const [id, text] = vi.mocked(api.attachPreview).mock.calls[0]!;
    expect(id).toBe("G".repeat(32));
    expect(text).not.toContain("supersecretvalue");
  });

  it("skips it for older servers, repos that opt out, decided gates and short timeouts", async () => {
    for (const [created, options] of [
      [gate(), {}],
      [gate({ previews: true }), { previews: false }],
      [gate({ previews: true, status: "approved" }), {}],
      [gate({ previews: true }), { timeout: 40 }],
    ] as const) {
      const { api, deps } = setup(created, options);
      await decide(run, deps);
      expect(deps.preview).not.toHaveBeenCalled();
      expect(api.attachPreview).not.toHaveBeenCalled();
    }
  });
});
