import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { castVote, createGate, VoteRejectedError } from "@/features/gates/server/gates";
import { authenticateHookToken, mintHookToken } from "@/features/gates/server/hook-tokens";
import { createGateSchema } from "@/features/gates/shared/hook-api";
import { endFreeze, FreezeError, loadFreeze, startFreeze } from "@/features/teams/server/freeze";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@freeze.int.test";

describe.skipIf(!safe)("freeze and incident mode (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let teamId = "";
  let repoId = "";
  let owner = "";
  let dev = "";
  let ana = "";
  let ben = "";
  let requester = "";
  let token = "";
  let hash = 0;

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  beforeAll(async () => {
    owner = await user("owner");
    dev = await user("dev");
    ana = await user("ana");
    ben = await user("ben");
    requester = await user("req");
    teamId = newAlnumId();
    await db.team.create({ data: { id: teamId, name: "freeze", nexconnChannelId: `tg${teamId}` } });
    await db.membership.createMany({
      data: [
        { teamId, userId: owner, role: "owner" },
        { teamId, userId: dev, role: "approver" },
        { teamId, userId: ana, role: "approver" },
        { teamId, userId: ben, role: "approver" },
        { teamId, userId: requester, role: "requester" },
      ],
    });
    repoId = newAlnumId();
    await db.repoLink.create({ data: { id: repoId, teamId, name: "acme/freeze", presets: [] } });
    token = (await mintHookToken(db, { id: newAlnumId(), repoId, createdById: dev })).token;
    // A rule that auto-approves staging deploys, and an open approval window for them.
    await db.policyRule.create({
      data: {
        id: newAlnumId(),
        repoId,
        preset: "staging-deploy",
        env: "staging",
        action: "auto_approve",
      },
    });
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  async function raise(command: string) {
    const principal = (await authenticateHookToken(db, `Bearer ${token}`))!;
    const input = createGateSchema.parse({
      preset: "x",
      command,
      cwd: "/w",
      cmdHash: (++hash).toString(16).padStart(64, "0"),
    });
    return createGate(db, principal, input, { newId: () => newAlnumId() });
  }

  it("only owners and approvers can start or end one", async () => {
    await expect(
      startFreeze(db, { teamId, userId: requester, kind: "incident", minutes: 60 }),
    ).rejects.toMatchObject({ reason: "not_allowed" });
    await expect(
      startFreeze(db, { teamId, userId: newAlnumId(), kind: "incident", minutes: 60 }),
    ).rejects.toThrow(FreezeError);
    expect(await loadFreeze(db, teamId)).toBeNull();
  });

  it("before a freeze, the rule approves staging on arrival", async () => {
    const gate = await raise("fly deploy -a billing-staging");
    expect(gate).toMatchObject({ status: "approved", frozen: false });
  });

  it("during a freeze: no rules, stricter production, an owner can still decide", async () => {
    const freeze = await startFreeze(db, {
      teamId,
      userId: ana,
      kind: "incident",
      reason: "Checkout is down, token sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
      minutes: 60,
    });
    expect(freeze).toMatchObject({ kind: "incident", by: "ana" });
    expect(freeze.reason).not.toContain("abcdefghijklmnop");

    const staging = await raise("fly deploy -a billing-staging");
    expect(staging).toMatchObject({
      status: "pending",
      frozen: true,
      quorum: 1,
      policyRuleId: null,
    });

    // vercel --prod: preset quorum 2 already; fly deploy (prod) asks 2 too. Use a quorum-1 prod
    // command: db-migrate on prod.
    const prod = await raise("DATABASE_URL=postgres://prod-db/app prisma migrate deploy");
    expect(prod).toMatchObject({ env: "prod", frozen: true, quorum: 2 });
    const first = await castVote(db, {
      gateId: prod.id,
      userId: ana,
      decision: "approve",
      newId: () => newAlnumId(),
    });
    expect(first.evaluation.status).toBe("pending");

    const another = await raise("DATABASE_URL=postgres://prod-db/app prisma migrate deploy --x");
    const byOwner = await castVote(db, {
      gateId: another.id,
      userId: owner,
      decision: "approve",
      newId: () => newAlnumId(),
    });
    expect(byOwner.evaluation.status).toBe("approved");
  });

  it("refuses new approval windows while frozen", async () => {
    const gate = await raise("fly deploy -a web-staging");
    await expect(
      castVote(db, {
        gateId: gate.id,
        userId: ana,
        decision: "approve",
        windowMinutes: 60,
        newId: () => newAlnumId(),
      }),
    ).rejects.toMatchObject({ reason: "window_not_allowed" } satisfies Partial<VoteRejectedError>);
  });

  it("ends early, and gates raised during it keep its rules", async () => {
    const during = await raise("DATABASE_URL=postgres://prod-db/app prisma migrate deploy --y");
    expect(await endFreeze(db, { teamId, userId: owner })).toBe(true);
    expect(await endFreeze(db, { teamId, userId: owner })).toBe(false);
    expect(await loadFreeze(db, teamId)).toBeNull();
    const vote = await castVote(db, {
      gateId: during.id,
      userId: ana,
      decision: "approve",
      newId: () => newAlnumId(),
    });
    expect(vote.evaluation.status).toBe("pending");
    expect((await raise("fly deploy -a billing-staging --again")).status).toBe("approved");
  });
});
