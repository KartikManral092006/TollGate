import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordOutcome, OUTCOME_WINDOW_MS } from "@/features/gates/server/outcomes";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@outcomes.int.test";
const HASH = "a".repeat(64);

describe.skipIf(!safe)("recording what an approved call did (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let teamId = "";
  let repoId = "";
  let otherRepoId = "";
  let requesterId = "";
  let code = 0;

  async function gate(patch: {
    repoId?: string;
    status?: "pending" | "approved" | "denied";
    decidedAt?: Date | null;
    cmdHash?: string;
  }) {
    const status = patch.status ?? "approved";
    const created = await db.gate.create({
      data: {
        id: newAlnumId(),
        code: ++code,
        teamId,
        repoId: patch.repoId ?? repoId,
        requesterId,
        preset: "prod-deploy",
        env: "prod",
        command: "vercel --prod",
        cwd: "/w",
        context: "",
        redactions: 0,
        cmdHash: patch.cmdHash ?? HASH,
        quorum: 1,
        status,
        decidedAt:
          patch.decidedAt === undefined
            ? status === "pending"
              ? null
              : new Date()
            : patch.decidedAt,
      },
    });
    return created.id;
  }

  beforeAll(async () => {
    requesterId = newAlnumId();
    await db.user.create({
      data: {
        id: requesterId,
        nexconnUserId: requesterId,
        name: "Dev",
        email: `dev${EMAIL_DOMAIN}`,
      },
    });
    teamId = newAlnumId();
    await db.team.create({
      data: { id: teamId, name: "outcomes", nexconnChannelId: `tg${teamId}` },
    });
    repoId = newAlnumId();
    otherRepoId = newAlnumId();
    await db.repoLink.createMany({
      data: [
        { id: repoId, teamId, name: "acme/web", presets: [] },
        { id: otherRepoId, teamId, name: "acme/other", presets: [] },
      ],
    });
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  it("attaches to the newest approved gate for the call, once, and redacts the output", async () => {
    const older = await gate({ decidedAt: new Date(Date.now() - 60_000) });
    const newer = await gate({});
    const report = {
      cmdHash: HASH,
      outcome: "failed" as const,
      exitCode: 1,
      durationMs: 1200,
      output: "Error: auth failed for sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
    };
    expect(await recordOutcome(db, { repoId, report })).toBe(newer);
    const row = await db.gate.findUniqueOrThrow({ where: { id: newer } });
    expect(row).toMatchObject({ outcome: "failed", exitCode: 1, durationMs: 1200 });
    expect(row.output).not.toContain("abcdefghijklmnop");
    // The next run of the same command lands on the older approval still waiting for one.
    expect(await recordOutcome(db, { repoId, report: { ...report, outcome: "succeeded" } })).toBe(
      older,
    );
    expect(await recordOutcome(db, { repoId, report })).toBeNull();
  });

  it("ignores open, denied, stale and other repos' gates", async () => {
    const hash = "b".repeat(64);
    await gate({ cmdHash: hash, status: "pending" });
    await gate({ cmdHash: hash, status: "denied" });
    await gate({ cmdHash: hash, decidedAt: new Date(Date.now() - OUTCOME_WINDOW_MS - 60_000) });
    await gate({ cmdHash: hash, repoId: otherRepoId });
    expect(
      await recordOutcome(db, { repoId, report: { cmdHash: hash, outcome: "succeeded" } }),
    ).toBeNull();
  });
});
