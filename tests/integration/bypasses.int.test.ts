import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BYPASS_MAX_AGE_MS,
  recordBypass,
  reviewBypass,
  ReviewRejectedError,
} from "@/features/gates/server/bypasses";
import { authenticateHookToken, mintHookToken } from "@/features/gates/server/hook-tokens";
import { recordOutcome } from "@/features/gates/server/outcomes";
import { reportBypassSchema } from "@/features/gates/shared/hook-api";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@bypasses.int.test";

describe.skipIf(!safe)("bypassed calls (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let teamId = "";
  let dev = "";
  let ana = "";
  let client = "";
  let token = "";

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  beforeAll(async () => {
    dev = await user("dev");
    ana = await user("ana");
    client = await user("client");
    teamId = newAlnumId();
    await db.team.create({ data: { id: teamId, name: "bypass", nexconnChannelId: `tg${teamId}` } });
    await db.membership.createMany({
      data: [
        { teamId, userId: dev, role: "owner" },
        { teamId, userId: ana, role: "approver" },
        { teamId, userId: client, role: "requester" },
      ],
    });
    const repoId = newAlnumId();
    await db.repoLink.create({ data: { id: repoId, teamId, name: "acme/bypass", presets: [] } });
    token = (await mintHookToken(db, { id: newAlnumId(), repoId, createdById: dev })).token;
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  const report = (patch: Record<string, unknown> = {}) =>
    reportBypassSchema.parse({
      id: newAlnumId(),
      at: Date.now() - 60_000,
      preset: "prod-deploy",
      command: "vercel --prod --token=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
      cwd: "/w",
      cmdHash: "d".repeat(64),
      ...patch,
    });

  const principal = async () => (await authenticateHookToken(db, `Bearer ${token}`))!;

  it("records the call as bypassed, once, dated when it happened and redacted again", async () => {
    const input = report();
    const first = await recordBypass(db, await principal(), input);
    expect(first?.created).toBe(true);
    const again = await recordBypass(db, await principal(), input);
    expect(again).toEqual({ gate: first!.gate, created: false });

    const gate = await db.gate.findUniqueOrThrow({ where: { id: input.id } });
    expect(gate).toMatchObject({ status: "bypassed", env: "prod", requesterId: dev });
    expect(gate.command).not.toContain("abcdefghijklmnop");
    expect(gate.createdAt.getTime()).toBe(input.at);
    expect(gate.decidedAt?.getTime()).toBe(input.at);
    // Its run's outcome lands on it like an approved gate's.
    expect(
      await recordOutcome(db, {
        repoId: gate.repoId,
        report: { cmdHash: gate.cmdHash, outcome: "succeeded" },
      }),
    ).toBe(gate.id);
  });

  it("dates a report from the future or older than a week as now", async () => {
    for (const at of [Date.now() + 3_600_000, Date.now() - BYPASS_MAX_AGE_MS - 60_000]) {
      const input = report({ at });
      await recordBypass(db, await principal(), input);
      const gate = await db.gate.findUniqueOrThrow({ where: { id: input.id } });
      expect(Math.abs(gate.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
    }
  });

  it("lets a teammate who can vote review it, once, but not the person who bypassed", async () => {
    const input = report();
    await recordBypass(db, await principal(), input);
    await expect(reviewBypass(db, { gateId: input.id, userId: dev })).rejects.toMatchObject({
      reason: "own_gate",
    });
    await expect(reviewBypass(db, { gateId: input.id, userId: client })).rejects.toMatchObject({
      reason: "not_allowed",
    });
    await expect(reviewBypass(db, { gateId: input.id, userId: newAlnumId() })).rejects.toThrow(
      ReviewRejectedError,
    );

    const first = await reviewBypass(db, {
      gateId: input.id,
      userId: ana,
      note: "Hotfix for the outage, checked the deploy",
    });
    expect(first).toEqual({ teamId, reviewedNow: true });
    expect(
      (await reviewBypass(db, { gateId: input.id, userId: ana, note: "again" })).reviewedNow,
    ).toBe(false);
    const gate = await db.gate.findUniqueOrThrow({ where: { id: input.id } });
    expect(gate).toMatchObject({
      reviewedById: ana,
      reviewNote: "Hotfix for the outage, checked the deploy",
    });
  });

  it("only reviews bypasses", async () => {
    const gate = await db.gate.create({
      data: {
        id: newAlnumId(),
        code: 9999,
        teamId,
        repoId: (await principal()).repoId,
        requesterId: dev,
        preset: "prod-deploy",
        env: "prod",
        command: "x",
        cwd: "/w",
        context: "",
        redactions: 0,
        cmdHash: "e".repeat(64),
        quorum: 1,
        status: "approved",
      },
    });
    await expect(reviewBypass(db, { gateId: gate.id, userId: ana })).rejects.toMatchObject({
      reason: "not_bypassed",
    });
  });
});
