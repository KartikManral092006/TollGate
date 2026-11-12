import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateHookToken, mintHookToken } from "@/features/gates/server/hook-tokens";
import { deleteTeam } from "@/features/teams/server/delete-team";
import { leaveTeam } from "@/features/teams/server/members";
import { renameTeam } from "@/features/teams/server/rename-team";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

// Runs against a real Postgres (TEST_DATABASE_URL). Kept out of `pnpm test`.
const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@delete-team.int.test";

describe.skipIf(!safe)("deleting and leaving a team (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let owner = "";
  let ana = "";
  let ben = "";
  let code = 0;
  const teams: string[] = [];

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  // A team with everything that hangs off one: a repo and token, gates with votes, follow-ups,
  // a window, a rule, an invite, a call, an AI config and a "seen" mark.
  async function fullTeam(name: string) {
    const teamId = newAlnumId();
    teams.push(teamId);
    await db.team.create({ data: { id: teamId, name, nexconnChannelId: `tg${teamId}` } });
    await db.membership.createMany({
      data: [
        { teamId, userId: owner, role: "owner" },
        { teamId, userId: ana, role: "approver" },
        { teamId, userId: ben, role: "requester" },
      ],
    });
    const repoId = newAlnumId();
    await db.repoLink.create({ data: { id: repoId, teamId, name: "acme/app", presets: [] } });
    const token = (await mintHookToken(db, { id: newAlnumId(), repoId, createdById: ben })).token;
    const gate = async (status: "pending" | "approved", followUpOfId?: string) =>
      (
        await db.gate.create({
          data: {
            id: newAlnumId(),
            code: ++code,
            teamId,
            repoId,
            requesterId: ben,
            preset: "staging-deploy",
            env: "staging",
            command: `fly deploy #${code}`,
            cwd: "/w",
            context: "",
            redactions: 0,
            cmdHash: newAlnumId(),
            quorum: 1,
            status,
            followUpOfId,
          },
        })
      ).id;
    const decided = await gate("approved");
    const open = await gate("pending", decided);
    await db.vote.createMany({
      data: [
        { gateId: decided, userId: ana, decision: "approve" },
        { gateId: open, userId: ana, decision: "approve" },
      ],
    });
    const window = await db.approvalWindow.create({
      data: {
        id: newAlnumId(),
        teamId,
        repoId,
        preset: "staging-deploy",
        env: "staging",
        requesterId: ben,
        createdById: ana,
        gateId: decided,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await db.gate.update({ where: { id: open }, data: { windowId: window.id } });
    await db.policyRule.create({
      data: {
        id: newAlnumId(),
        repoId,
        preset: "staging-deploy",
        env: "staging",
        action: "auto_approve",
        createdById: owner,
      },
    });
    await db.invite.create({
      data: {
        id: newAlnumId(),
        teamId,
        tokenHash: newAlnumId(),
        createdById: ana,
        gateId: open,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await db.gateSeen.create({ data: { gateId: open, userId: ana } });
    return { teamId, token, open };
  }

  beforeAll(async () => {
    owner = await user("owner");
    ana = await user("ana");
    ben = await user("ben");
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { id: { in: teams } } });
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await db.$disconnect();
  });

  it("only lets an owner delete, and only with the team's name typed", async () => {
    const { teamId } = await fullTeam("Acme web");
    await expect(
      deleteTeam(db, { teamId, actorId: ana, confirmName: "Acme web" }),
    ).rejects.toMatchObject({ reason: "not_owner" });
    await expect(
      deleteTeam(db, { teamId, actorId: newAlnumId(), confirmName: "Acme web" }),
    ).rejects.toMatchObject({ reason: "not_found" });
    await expect(
      deleteTeam(db, { teamId, actorId: owner, confirmName: "acme web" }),
    ).rejects.toMatchObject({ reason: "wrong_name" });
    await expect(deleteTeam(db, { teamId, actorId: owner, confirmName: "" })).rejects.toMatchObject(
      { reason: "wrong_name" },
    );
    expect(await db.team.count({ where: { id: teamId } })).toBe(1);
  });

  it("deletes the team and everything in it, and nothing else", async () => {
    const doomed = await fullTeam("Old prototype");
    const kept = await fullTeam("Still running");
    expect(await authenticateHookToken(db, `Bearer ${doomed.token}`)).not.toBeNull();

    const deleted = await deleteTeam(db, {
      teamId: doomed.teamId,
      actorId: owner,
      confirmName: "  Old prototype ",
    });
    expect(deleted).toMatchObject({
      name: "Old prototype",
      hadChatGroup: false,
      repos: 1,
      gates: 2,
      members: 3,
    });

    const teamId = doomed.teamId;
    expect(await db.team.count({ where: { id: teamId } })).toBe(0);
    expect(await db.membership.count({ where: { teamId } })).toBe(0);
    expect(await db.repoLink.count({ where: { teamId } })).toBe(0);
    expect(await db.gate.count({ where: { teamId } })).toBe(0);
    expect(await db.vote.count({ where: { gateId: doomed.open } })).toBe(0);
    expect(await db.approvalWindow.count({ where: { teamId } })).toBe(0);
    expect(await db.invite.count({ where: { teamId } })).toBe(0);
    expect(await db.gateSeen.count({ where: { gateId: doomed.open } })).toBe(0);
    expect(await authenticateHookToken(db, `Bearer ${doomed.token}`)).toBeNull();

    // People keep their accounts; the other team is untouched.
    expect(await db.user.count({ where: { id: { in: [owner, ana, ben] } } })).toBe(3);
    expect(await db.gate.count({ where: { teamId: kept.teamId } })).toBe(2);
    expect(await authenticateHookToken(db, `Bearer ${kept.token}`)).not.toBeNull();
  });

  it("lets anyone but an owner leave, switching off what they could still use", async () => {
    const { teamId, token } = await fullTeam("Client site");
    await expect(leaveTeam(db, { teamId, userId: owner })).rejects.toMatchObject({
      reason: "owner",
    });
    await expect(leaveTeam(db, { teamId, userId: newAlnumId() })).rejects.toMatchObject({
      reason: "not_member",
    });

    const left = await leaveTeam(db, { teamId, userId: ben });
    expect(left).toMatchObject({ tokens: 1, windows: 1, gates: 1 });
    expect(
      await db.membership.findUnique({ where: { teamId_userId: { teamId, userId: ben } } }),
    ).toBeNull();
    expect(await authenticateHookToken(db, `Bearer ${token}`)).toBeNull();
    // The team and its history stay for everyone else.
    expect(await db.gate.count({ where: { teamId } })).toBe(2);
    expect(await db.membership.count({ where: { teamId } })).toBe(2);
  });

  it("lets only the owner rename a team, and reports whether it changed", async () => {
    const { teamId } = await fullTeam("Typo teem");
    await expect(renameTeam(db, { teamId, actorId: ana, name: "Hijacked" })).rejects.toMatchObject({
      reason: "not_owner",
    });
    const renamed = await renameTeam(db, { teamId, actorId: owner, name: "  Typo team " });
    expect(renamed).toMatchObject({ name: "Typo team", changed: true, hadChatGroup: false });
    expect((await db.team.findUnique({ where: { id: teamId } }))?.name).toBe("Typo team");
    const again = await renameTeam(db, { teamId, actorId: owner, name: "Typo team" });
    expect(again.changed).toBe(false);
  });
});
