import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateHookToken, mintHookToken } from "@/features/gates/server/hook-tokens";
import { removeMember, RemoveMemberError } from "@/features/teams/server/members";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@members.int.test";

describe.skipIf(!safe)("removing a member (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  // owner removes ana; ben stays. ana has a token, an open gate, a vote on ben's open gate,
  // a vote on a decided gate, an approval window and an invite link.
  let owner = "";
  let ana = "";
  let ben = "";
  let teamId = "";
  let repoId = "";
  let anaToken = "";
  let anaGate = "";
  let bensOpenGate = "";
  let decidedGate = "";
  let code = 0;

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  async function gate(requesterId: string, status: "pending" | "approved") {
    const created = await db.gate.create({
      data: {
        id: newAlnumId(),
        code: ++code,
        teamId,
        repoId,
        requesterId,
        preset: "staging-deploy",
        env: "staging",
        command: `fly deploy #${code}`,
        cwd: "/w",
        context: "",
        redactions: 0,
        cmdHash: newAlnumId(),
        quorum: 2,
        status,
      },
    });
    return created.id;
  }

  beforeAll(async () => {
    owner = await user("owner");
    ana = await user("ana");
    ben = await user("ben");
    teamId = newAlnumId();
    await db.team.create({
      data: { id: teamId, name: "members", nexconnChannelId: `tg${teamId}` },
    });
    await db.membership.createMany({
      data: [
        { teamId, userId: owner, role: "owner" },
        { teamId, userId: ana, role: "approver" },
        { teamId, userId: ben, role: "approver" },
      ],
    });
    repoId = newAlnumId();
    await db.repoLink.create({ data: { id: repoId, teamId, name: "acme/members", presets: [] } });
    anaToken = (await mintHookToken(db, { id: newAlnumId(), repoId, createdById: ana })).token;

    anaGate = await gate(ana, "pending");
    bensOpenGate = await gate(ben, "pending");
    decidedGate = await gate(ben, "approved");
    await db.vote.createMany({
      data: [
        { gateId: bensOpenGate, userId: ana, decision: "approve" },
        { gateId: decidedGate, userId: ana, decision: "approve" },
      ],
    });
    await db.approvalWindow.create({
      data: {
        id: newAlnumId(),
        teamId,
        repoId,
        preset: "staging-deploy",
        env: "staging",
        requesterId: ben,
        createdById: ana,
        gateId: decidedGate,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await db.invite.create({
      data: {
        id: newAlnumId(),
        teamId,
        tokenHash: newAlnumId(),
        createdById: ana,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  it("refuses non-owners, the owner themselves and unknown people", async () => {
    await expect(removeMember(db, { teamId, actorId: ben, userId: ana })).rejects.toMatchObject({
      reason: "not_owner",
    });
    await expect(removeMember(db, { teamId, actorId: owner, userId: owner })).rejects.toThrow(
      RemoveMemberError,
    );
    await expect(
      removeMember(db, { teamId, actorId: owner, userId: newAlnumId() }),
    ).rejects.toMatchObject({ reason: "not_member" });
    // The owner role can't be removed even by another owner.
    await db.membership.update({
      where: { teamId_userId: { teamId, userId: ben } },
      data: { role: "owner" },
    });
    await expect(removeMember(db, { teamId, actorId: owner, userId: ben })).rejects.toMatchObject({
      reason: "owner",
    });
    await db.membership.update({
      where: { teamId_userId: { teamId, userId: ben } },
      data: { role: "approver" },
    });
  });

  it("removes the member and switches off everything they could still use", async () => {
    expect(await authenticateHookToken(db, `Bearer ${anaToken}`)).not.toBeNull();

    const removed = await removeMember(db, { teamId, actorId: owner, userId: ana });
    expect(removed).toMatchObject({ tokens: 1, windows: 1, votes: 1, gates: 1, invites: 1 });

    expect(
      await db.membership.findUnique({ where: { teamId_userId: { teamId, userId: ana } } }),
    ).toBeNull();
    expect(await authenticateHookToken(db, `Bearer ${anaToken}`)).toBeNull();
    expect((await db.gate.findUnique({ where: { id: anaGate } }))?.status).toBe("expired");
    // Withdrawn from the open gate, kept on the decided one (the audit log).
    expect(await db.vote.count({ where: { userId: ana, gateId: bensOpenGate } })).toBe(0);
    expect(await db.vote.count({ where: { userId: ana, gateId: decidedGate } })).toBe(1);
    expect(
      await db.approvalWindow.count({ where: { teamId, createdById: ana, endedAt: null } }),
    ).toBe(0);
    expect(await db.invite.count({ where: { teamId, createdById: ana, revokedAt: null } })).toBe(0);
    // Ben is untouched.
    expect(
      await db.membership.findUnique({ where: { teamId_userId: { teamId, userId: ben } } }),
    ).not.toBeNull();
  });
});
