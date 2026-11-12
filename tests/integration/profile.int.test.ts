import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadProfile } from "@/features/profile/server/profile";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@profile.int.test";

describe.skipIf(!safe)("profiles (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  // ana is the profile; ben shares the "shared" team with her; cy shares nothing.
  let ana = "";
  let ben = "";
  let cy = "";
  let sharedTeam = "";
  let privateTeam = "";
  let anaSession = "";

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  async function team(name: string, members: [string, "owner" | "approver"][]) {
    const id = newAlnumId();
    await db.team.create({ data: { id, name, nexconnChannelId: `tg${id}` } });
    await db.membership.createMany({
      data: members.map(([userId, role]) => ({ teamId: id, userId, role })),
    });
    const repo = await db.repoLink.create({
      data: { id: newAlnumId(), teamId: id, name: `acme/${name}`, presets: [] },
    });
    return { id, repoId: repo.id };
  }

  async function gate(teamId: string, repoId: string, requesterId: string, code: number) {
    return db.gate.create({
      data: {
        id: newAlnumId(),
        code,
        teamId,
        repoId,
        requesterId,
        preset: "db-migrate",
        env: "prod",
        command: `prisma migrate deploy #${code}`,
        cwd: "/w",
        context: "",
        redactions: 0,
        cmdHash: newAlnumId(),
        quorum: 1,
      },
    });
  }

  beforeAll(async () => {
    ana = await user("ana");
    ben = await user("ben");
    cy = await user("cy");
    const shared = await team("shared", [
      [ana, "approver"],
      [ben, "owner"],
    ]);
    const solo = await team("private", [[ana, "owner"]]);
    sharedTeam = shared.id;
    privateTeam = solo.id;

    await gate(shared.id, shared.repoId, ana, 1);
    await gate(solo.id, solo.repoId, ana, 1);
    const bensGate = await gate(shared.id, shared.repoId, ben, 2);
    const bensPrivate = await gate(solo.id, solo.repoId, ben, 2);
    await db.vote.createMany({
      data: [
        { gateId: bensGate.id, userId: ana, decision: "approve" },
        { gateId: bensPrivate.id, userId: ana, decision: "deny", reason: "wrong db" },
      ],
    });
    await db.hookToken.create({
      data: {
        id: newAlnumId(),
        repoId: shared.repoId,
        tokenHash: newAlnumId(),
        prefix: "tg_abc",
        createdById: ana,
      },
    });
    anaSession = newAlnumId();
    await db.session.createMany({
      data: [
        {
          id: anaSession,
          token: newAlnumId(),
          userId: ana,
          expiresAt: new Date(Date.now() + 86_400_000),
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0 Safari/537.36",
        },
        {
          id: newAlnumId(),
          token: newAlnumId(),
          userId: ana,
          expiresAt: new Date(Date.now() - 1000),
        },
      ],
    });
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: { in: [sharedTeam, privateTeam] } } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  it("shows you everything on your own profile, sessions and tokens included", async () => {
    const view = await loadProfile(db, {
      viewerId: ana,
      targetId: ana,
      currentSessionId: anaSession,
    });
    expect(view).not.toBeNull();
    expect(view!.isSelf).toBe(true);
    expect(view!.user.email).toMatch(EMAIL_DOMAIN);
    expect(view!.teams.map((t) => t.name).sort()).toEqual(["private", "shared"]);
    expect(view!.gates).toHaveLength(2);
    expect(view!.votes).toHaveLength(2);
    expect(view!.tokens).toHaveLength(1);
    // The expired session isn't listed; this browser is marked.
    expect(view!.sessions).toEqual([
      expect.objectContaining({ id: anaSession, current: true, device: "Chrome on macOS" }),
    ]);
  });

  it("shows a teammate only the teams you share, and nothing private", async () => {
    const view = await loadProfile(db, { viewerId: ben, targetId: ana, currentSessionId: null });
    expect(view).not.toBeNull();
    expect(view!.isSelf).toBe(false);
    expect(view!.user.email).toBeNull();
    expect(view!.teams.map((t) => t.id)).toEqual([sharedTeam]);
    expect(view!.gates.every((g) => g.teamId === sharedTeam)).toBe(true);
    expect(view!.gates).toHaveLength(1);
    expect(view!.votes).toEqual([
      expect.objectContaining({ teamId: sharedTeam, decision: "approve" }),
    ]);
    expect(view!.tokens).toBeNull();
    expect(view!.sessions).toBeNull();
  });

  it("hides the profile from people who share no team, and unknown ids", async () => {
    expect(
      await loadProfile(db, { viewerId: cy, targetId: ana, currentSessionId: null }),
    ).toBeNull();
    expect(
      await loadProfile(db, { viewerId: ana, targetId: newAlnumId(), currentSessionId: null }),
    ).toBeNull();
  });
});
