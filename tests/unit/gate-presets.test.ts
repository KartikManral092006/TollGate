import { describe, expect, it } from "vitest";
import {
  authoritativeQuorum,
  DEFAULT_PRESETS,
  detectEnv,
  matchPreset,
  presetListSchema,
  rmTargetsOutsideRepo,
} from "@/features/gates/shared/presets";

const repo = { cwd: "/work/acme", repoRoot: "/work/acme" };
const match = (command: string, where = repo) =>
  matchPreset(DEFAULT_PRESETS, { command, ...where });

describe("DEFAULT_PRESETS", () => {
  it("is a valid preset list", () => {
    expect(presetListSchema.safeParse(DEFAULT_PRESETS).success).toBe(true);
  });

  it.each([
    ["vercel --prod", "prod-deploy", "prod", 2],
    ["npx vercel deploy --prod --yes", "prod-deploy", "prod", 2],
    ["fly deploy", "prod-deploy", "prod", 2],
    ["flyctl deploy -a billing-staging", "staging-deploy", "staging", 1],
    ["railway up --environment production", "prod-deploy", "prod", 2],
    ["railway up --environment staging", "staging-deploy", "staging", 1],
    ["vercel", "staging-deploy", "staging", 1],
    ["npx prisma migrate deploy", "db-migrate", "other", 1],
    ["DATABASE_ENV=production npx prisma migrate deploy", "db-migrate", "prod", 2],
    ["drizzle-kit push", "db-migrate", "other", 1],
    ['psql "$DB" -c "ALTER TABLE invoices DROP COLUMN legacy_total"', "db-migrate", "other", 1],
    ["npm publish --access public", "publish", "prod", 1],
    ["pnpm publish", "publish", "prod", 1],
    ["cargo publish", "publish", "prod", 1],
    ["twine upload dist/*", "publish", "prod", 1],
    ["terraform apply -auto-approve", "infra", "other", 2],
    ["pulumi destroy --stack prod", "infra", "prod", 2],
    ["aws rds delete-db-instance --db-instance-identifier x", "infra", "other", 2],
    ["aws s3 rm s3://bucket --recursive", "infra", "other", 2],
    ["gcloud compute instances delete vm-1", "infra", "other", 2],
    ["echo tollgate-test", "tollgate-test", "other", 1],
  ])("%s → %s (%s, quorum %i)", (command, preset, env, quorum) => {
    expect(match(command)).toMatchObject({ preset: { name: preset }, env, quorum });
  });

  it.each([
    "npm test",
    "npx prisma migrate dev",
    "npx prisma generate",
    "git push origin main",
    "psql -c 'select 1'",
    "vercel env ls",
    "terraform plan",
    "aws s3 ls",
    "echo tollgate-test && rm -rf build",
    "rm -rf node_modules .next",
    "ls -la",
  ])("leaves %s alone", (command) => {
    expect(match(command)).toBeNull();
  });
});

describe("destructive-fs", () => {
  it.each([
    "rm -rf ~/projects",
    "rm -rf /",
    "rm -rf ../other-repo",
    "rm -rf $HOME/x",
    "rm -fr /var/lib/postgresql",
    "rm -r -f /tmp/../etc",
    "cd /tmp && rm -rf *",
  ])("gates %s", (command) => {
    expect(match(command)?.preset.name).toBe("destructive-fs");
  });

  it("treats deleting the repo root itself as outside", () => {
    expect(rmTargetsOutsideRepo("rm -rf .", "/work/acme", "/work/acme")).toBe(true);
  });

  it("allows deletes inside the repo, including from a subdirectory", () => {
    expect(rmTargetsOutsideRepo("rm -rf dist", "/work/acme/web", "/work/acme")).toBe(false);
    expect(rmTargetsOutsideRepo("rm -rf ../api/build", "/work/acme/web", "/work/acme")).toBe(false);
  });

  it("does not treat a sibling with a shared prefix as inside", () => {
    expect(rmTargetsOutsideRepo("rm -rf /work/acme-old", "/work/acme", "/work/acme")).toBe(true);
  });
});

describe("detectEnv", () => {
  it.each([
    ["deploy --prod", "prod"],
    ["--env=production", "prod"],
    ["-a api-prod", "prod"],
    ["-a api-staging", "staging"],
    ["--stage beta", "other"],
    ["product-page build", "other"],
  ])("%s → %s", (command, env) => {
    expect(detectEnv(command)).toBe(env);
  });
});

describe("authoritativeQuorum", () => {
  it("never lets a client lower the server's quorum", () => {
    const server = match("vercel --prod");
    expect(authoritativeQuorum(server, 1)).toBe(2);
  });

  it("lets a client raise it", () => {
    expect(authoritativeQuorum(match("npm publish"), 3)).toBe(3);
  });

  it("defaults to 1 for a preset only the client knows", () => {
    expect(authoritativeQuorum(null, undefined)).toBe(1);
  });
});

describe("custom presets", () => {
  it("skips a broken regex instead of throwing", () => {
    const presets = [{ name: "bad", patterns: ["(unclosed"], quorum: 1 }];
    expect(matchPreset(presets, { command: "anything", ...repo })).toBeNull();
  });
});
