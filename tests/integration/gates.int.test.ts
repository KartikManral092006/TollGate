import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CallRejectedError, requestHuddlePermit, sweepCalls } from "@/features/call/server/permits";
import {
  castVote,
  consumeGrant,
  createGate,
  expireParkedGates,
  getGateForRepo,
  parkGate,
  VoteRejectedError,
} from "@/features/gates/server/gates";
import {
  authenticateHookToken,
  mintHookToken,
  revokeHookToken,
  type HookPrincipal,
} from "@/features/gates/server/hook-tokens";
import { commandHash, type CreateGateInput } from "@/features/gates/shared/hook-api";
import { DEFAULT_PRESETS } from "@/features/gates/shared/presets";
import { acceptInvite, createInvite, createTeam } from "@/features/teams/server/teams";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { newAlnumId } from "@/lib/ids";

const url = process.env.TEST_DATABASE_URL;
const safe = Boolean(url) && (process.env.CI === "true" || /\/[^/?]+_test(\?|$)/.test(url ?? ""));

const EMAIL_DOMAIN = "@gates.int.test";

describe.skipIf(!safe)("gates, votes, grants, tokens, calls, invites (Postgres)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const newId = () => newAlnumId();
  let requester = "";
  let approvers: string[] = [];
  let outsider = "";
  let teamId = "";
  let principal: HookPrincipal;
  let otherPrincipal: HookPrincipal;
  let token = "";

  async function user(label: string) {
    const id = newAlnumId();
    await db.user.create({
      data: { id, nexconnUserId: id, name: label, email: `${label}-${id}${EMAIL_DOMAIN}` },
    });
    return id;
  }

  async function repo(name: string) {
    const created = await db.repoLink.create({
      data: { id: newId(), teamId, name, presets: DEFAULT_PRESETS },
    });
    const minted = await mintHookToken(db, {
      id: newId(),
      repoId: created.id,
      createdById: requester,
    });
    const auth = await authenticateHookToken(db, `Bearer ${minted.token}`);
    if (!auth) throw new Error("token did not authenticate");
    return { principal: auth, token: minted.token };
  }

  function gateInput(command: string, extra: Partial<CreateGateInput> = {}): CreateGateInput {
    return {
      preset: "db-migrate",
      command,
      cwd: "/work/acme",
      branch: "main",
      context: "",
      redactions: 0,
      cmdHash: commandHash({ repo: "acme/billing", cwd: "/work/acme", command }),
      ...extra,
    };
  }

  async function cleanup() {
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  }

  beforeAll(async () => {
    await cleanup();
    requester = await user("requester");
    approvers = await Promise.all(Array.from({ length: 10 }, (_, i) => user(`approver${i}`)));
    outsider = await user("outsider");
    const team = await createTeam(db, { id: newId(), name: "Billing", ownerId: requester });
    teamId = team.id;
    await db.membership.createMany({
      data: approvers.map((userId) => ({ teamId, userId, role: "approver" as const })),
    });
    ({ principal, token } = await repo("acme/billing"));
    ({ principal: otherPrincipal } = await repo("acme/web"));
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("numbers concurrent gates TG-1..n without gaps or duplicates", async () => {
    const gates = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createGate(db, principal, gateInput(`npx prisma migrate deploy # ${i}`), { newId }),
      ),
    );
    const codes = gates.map((gate) => gate.code).sort((a, b) => a - b);
    expect(new Set(codes).size).toBe(10);
    expect(codes.at(-1)! - codes[0]!).toBe(9);
  });

  it("re-redacts on the server and never lets the client lower the quorum", async () => {
    const gate = await createGate(
      db,
      principal,
      gateInput("VERCEL_TOKEN=abc123secret vercel --prod", {
        preset: "x",
        quorum: 1,
        env: "other",
      }),
      { newId },
    );
    expect(gate.command).toBe("VERCEL_TOKEN=[REDACTED] vercel --prod");
    expect(gate.redactions).toBe(1);
    expect(gate.preset).toBe("prod-deploy");
    expect(gate.env).toBe("prod");
    expect(gate.quorum).toBe(2);
  });

  it("reaches quorum exactly once under 10 concurrent approvals", async () => {
    const gate = await createGate(db, principal, gateInput("vercel --prod"), { newId });
    expect(gate.quorum).toBe(2);
    const results = await Promise.allSettled(
      approvers.map((userId) =>
        castVote(db, { gateId: gate.id, userId, decision: "approve", newId }),
      ),
    );
    const accepted = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(accepted).toHaveLength(2);
    expect(
      accepted.filter((r) => r.status === "fulfilled" && r.value.evaluation.status === "approved"),
    ).toHaveLength(1);
    for (const r of rejected) {
      expect(r.status === "rejected" && r.reason).toBeInstanceOf(VoteRejectedError);
      expect(r.status === "rejected" && (r.reason as VoteRejectedError).reason).toBe("closed");
    }
    const after = await db.gate.findUniqueOrThrow({ where: { id: gate.id } });
    expect(after.status).toBe("approved");
    expect(await db.vote.count({ where: { gateId: gate.id } })).toBe(2);
    // Approved while the hook was still waiting: no grant is needed.
    expect(await db.grant.count({ where: { gateId: gate.id } })).toBe(0);
  });

  it("stores the deny reason as the agent's next instruction", async () => {
    const gate = await createGate(db, principal, gateInput("drizzle-kit push"), { newId });
    const outcome = await castVote(db, {
      gateId: gate.id,
      userId: approvers[0]!,
      decision: "deny",
      reason: "Rename, don't drop; back up first.",
      newId,
    });
    expect(outcome.evaluation.status).toBe("denied");
    const status = await getGateForRepo(db, gate.id, principal.repoId);
    expect(status?.gate.denyReason).toBe("Rename, don't drop; back up first.");
    expect(status?.decidedByName).toBe("approver0");
  });

  it("rejects the requester, non-members and double votes", async () => {
    const gate = await createGate(db, principal, gateInput("vercel --prod"), { newId });
    const vote = (userId: string) =>
      castVote(db, { gateId: gate.id, userId, decision: "approve", newId });
    await expect(vote(requester)).rejects.toMatchObject({ reason: "own_gate" });
    await expect(vote(outsider)).rejects.toMatchObject({ reason: "not_found" });
    await vote(approvers[0]!);
    await expect(vote(approvers[0]!)).rejects.toMatchObject({ reason: "voted" });
  });

  it("parks, approves later with one grant, and lets the grant be used once", async () => {
    const command = "npm publish";
    const input = gateInput(command);
    const gate = await createGate(db, principal, input, { newId });
    expect(await parkGate(db, { gateId: gate.id, repoId: principal.repoId })).toBe("parked");
    // Parking again (a retried hook) is harmless.
    expect(await parkGate(db, { gateId: gate.id, repoId: principal.repoId })).toBe("parked");

    const outcome = await castVote(db, {
      gateId: gate.id,
      userId: approvers[1]!,
      decision: "approve",
      newId,
    });
    expect(outcome.evaluation.status).toBe("approved");
    expect(outcome.grantExpiresAt).toBeInstanceOf(Date);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumeGrant(db, { repoId: principal.repoId, cmdHash: input.cmdHash }),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(attempts.find(Boolean)).toEqual({ gateId: gate.id });
  });

  it("binds a grant to its repo and command, and to its expiry", async () => {
    const input = gateInput("cargo publish");
    const gate = await createGate(db, principal, input, { newId });
    await parkGate(db, { gateId: gate.id, repoId: principal.repoId });
    await castVote(db, { gateId: gate.id, userId: approvers[2]!, decision: "approve", newId });

    expect(await consumeGrant(db, { repoId: otherPrincipal.repoId, cmdHash: input.cmdHash })).toBe(
      null,
    );
    const otherCommand = commandHash({ repo: "acme/billing", cwd: "/work/acme", command: "x" });
    expect(await consumeGrant(db, { repoId: principal.repoId, cmdHash: otherCommand })).toBe(null);
    const tomorrow = new Date(Date.now() + 25 * 3_600_000);
    expect(
      await consumeGrant(db, { repoId: principal.repoId, cmdHash: input.cmdHash, now: tomorrow }),
    ).toBe(null);
  });

  it("scopes tokens to their repo and honours revocation and membership", async () => {
    const gate = await createGate(db, principal, gateInput("terraform apply"), { newId });
    expect(await getGateForRepo(db, gate.id, otherPrincipal.repoId)).toBeNull();
    expect(await getGateForRepo(db, gate.id, principal.repoId)).not.toBeNull();

    expect(await authenticateHookToken(db, `Bearer ${token}x`)).toBeNull();
    expect(await authenticateHookToken(db, "Bearer tg_short")).toBeNull();

    const extra = await repo("acme/tmp");
    expect(await revokeHookToken(db, { tokenId: extra.principal.tokenId, teamId })).toBe(true);
    expect(await authenticateHookToken(db, `Bearer ${extra.token}`)).toBeNull();
  });

  it("gives one huddle permit per gate under concurrent requests", async () => {
    const gate = await createGate(db, principal, gateInput("fly deploy"), { newId });
    const policy = { enabled: true, minutesPerDay: 600 };
    const results = await Promise.allSettled(
      approvers.map((userId) =>
        requestHuddlePermit(db, {
          gateId: gate.id,
          userId,
          onlineMemberIds: [requester, ...approvers],
          policy,
          newId,
        }),
      ),
    );
    const starts = results.filter((r) => r.status === "fulfilled" && r.value.kind === "start");
    expect(starts).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect(r.status === "rejected" && (r.reason as CallRejectedError).reason).toBe("busy");
    }
    expect(await db.callSession.count({ where: { gateId: gate.id } })).toBe(1);
  });

  it("refuses calls when disabled, over budget, or with nobody allowed to ring", async () => {
    const gate = await createGate(db, principal, gateInput("pulumi up"), { newId });
    const ask = (policy: { enabled: boolean; minutesPerDay: number }, online: string[]) =>
      requestHuddlePermit(db, {
        gateId: gate.id,
        userId: approvers[3]!,
        onlineMemberIds: online,
        policy,
        newId,
      });
    await expect(ask({ enabled: false, minutesPerDay: 600 }, approvers)).rejects.toMatchObject({
      reason: "calls_disabled",
    });
    await expect(ask({ enabled: true, minutesPerDay: 600 }, [outsider])).rejects.toMatchObject({
      reason: "no_callees",
    });
    await expect(ask({ enabled: true, minutesPerDay: 0 }, approvers)).rejects.toMatchObject({
      reason: "budget",
    });
  });

  it("never over-redeems an invite under concurrent accepts", async () => {
    const invite = await createInvite(db, {
      id: newId(),
      teamId,
      createdById: requester,
      role: "guest",
      maxUses: 3,
      ttlHours: 1,
    });
    const guests = await Promise.all(Array.from({ length: 8 }, (_, i) => user(`guest${i}`)));
    const results = await Promise.all(
      guests.map((userId) => acceptInvite(db, { token: invite.token, userId })),
    );
    expect(results.filter((r) => r.ok && r.joinedNow)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.reason === "used_up")).toHaveLength(5);
    // An existing member re-opening the link gets in without spending a use.
    expect(await acceptInvite(db, { token: invite.token, userId: requester })).toEqual({
      ok: true,
      teamId,
      joinedNow: false,
    });
    expect(await acceptInvite(db, { token: `${invite.token}x`, userId: outsider })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
  it("expires parked gates after 24 h and refuses votes on them", async () => {
    const gate = await createGate(db, principal, gateInput("vercel --prod # stale"), { newId });
    const longAgo = new Date(Date.now() - 25 * 3_600_000);
    await parkGate(db, { gateId: gate.id, repoId: principal.repoId, now: longAgo });
    const fresh = await createGate(db, principal, gateInput("vercel --prod # fresh"), { newId });
    await parkGate(db, { gateId: fresh.id, repoId: principal.repoId });

    expect(
      await expireParkedGates(db, new Date(Date.now() - 24 * 3_600_000)),
    ).toBeGreaterThanOrEqual(1);
    expect((await db.gate.findUniqueOrThrow({ where: { id: gate.id } })).status).toBe("expired");
    expect((await db.gate.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("parked");
    await expect(
      castVote(db, { gateId: gate.id, userId: approvers[4]!, decision: "approve", newId }),
    ).rejects.toMatchObject({ reason: "closed" });
  });

  it("fails abandoned permits and closes calls that overran their cap", async () => {
    const gate = await createGate(db, principal, gateInput("terraform destroy"), { newId });
    const now = new Date();
    const abandoned = await db.callSession.create({
      data: {
        id: newId(),
        teamId,
        gateId: gate.id,
        kind: "ring",
        startedById: approvers[5]!,
        calleeIds: [approvers[6]!],
        createdAt: new Date(now.getTime() - 5 * 60_000),
      },
    });
    const overran = await db.callSession.create({
      data: {
        id: newId(),
        teamId,
        gateId: gate.id,
        kind: "huddle",
        status: "live",
        callId: newId(),
        startedById: approvers[5]!,
        calleeIds: [],
        maxSec: 900,
        startedAt: new Date(now.getTime() - 20 * 60_000),
      },
    });
    await sweepCalls(db, now);
    expect((await db.callSession.findUniqueOrThrow({ where: { id: abandoned.id } })).status).toBe(
      "failed",
    );
    const ended = await db.callSession.findUniqueOrThrow({ where: { id: overran.id } });
    expect(ended).toMatchObject({ status: "ended", durationSec: 900 });
  });
});
