import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGate } from "@/features/gates/server/gates";
import { authenticateHookToken, mintHookToken } from "@/features/gates/server/hook-tokens";
import { createGateSchema } from "@/features/gates/shared/hook-api";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@agent-task.int.test";

describe.skipIf(!safe)("the agent's task on a gate (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let teamId = "";
  let token = "";

  beforeAll(async () => {
    const userId = newAlnumId();
    await db.user.create({
      data: { id: userId, nexconnUserId: userId, name: "Dev", email: `dev${EMAIL_DOMAIN}` },
    });
    teamId = newAlnumId();
    await db.team.create({ data: { id: teamId, name: "task", nexconnChannelId: `tg${teamId}` } });
    await db.membership.create({ data: { teamId, userId, role: "owner" } });
    const repoId = newAlnumId();
    await db.repoLink.create({ data: { id: repoId, teamId, name: "acme/task", presets: [] } });
    token = (await mintHookToken(db, { id: newAlnumId(), repoId, createdById: userId })).token;
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  const body = () =>
    createGateSchema.parse({
      preset: "prod-deploy",
      command: "vercel --prod",
      cwd: "/w",
      cmdHash: "c".repeat(64),
      task: "Ship it, the key is ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      steps: ["$ pnpm test", "$ pnpm build (failed)"],
    });

  async function raise() {
    const principal = await authenticateHookToken(db, `Bearer ${token}`);
    return createGate(db, principal!, body(), { newId: () => newAlnumId() });
  }

  it("drops it unless the team shares it, whatever the client sends", async () => {
    const gate = await raise();
    expect(gate.task).toBeNull();
    expect(gate.steps).toBeNull();
  });

  it("keeps it, redacted again, once the team turns it on", async () => {
    await db.team.update({ where: { id: teamId }, data: { shareAgentTask: true } });
    const gate = await raise();
    expect(gate.task).toContain("Ship it");
    expect(gate.task).not.toContain("ghp_abcdefghijklmnop");
    expect(gate.steps).toBe("$ pnpm test\n$ pnpm build (failed)");
    expect(gate.redactions).toBeGreaterThan(0);
  });
});
