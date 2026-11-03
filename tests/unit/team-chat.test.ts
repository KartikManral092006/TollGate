import { describe, expect, it, vi } from "vitest";
import {
  ensureTeamChat,
  NotTeamMemberError,
  type TeamChatDeps,
} from "@/features/teams/server/team-chat";
import { NexconnApiError, type NexconnClient } from "@/features/nexconn/server/client";
import type { PrismaClient, Team } from "@/lib/generated/prisma/client";

const team = {
  id: "T".repeat(32),
  name: "Billing team",
  nexconnChannelId: `tg${"T".repeat(32)}`,
  nexconnGroupReadyAt: null,
} as Team;
const user = { id: "U".repeat(32), nexconnUserId: "U".repeat(32), name: "Ana" };

const apiError = (code: number) => new NexconnApiError("/v4/x", 200, code, "r", "failed");

// In-memory stand-in for the few Prisma calls ensureTeamChat makes.
function fakeDb(initial: { nexconnJoinedAt?: Date | null; member?: boolean } = {}) {
  const state = {
    member: initial.member ?? true,
    nexconnJoinedAt: initial.nexconnJoinedAt ?? null,
    groupReady: false,
  };
  const tx = {
    membership: {
      findUnique: vi.fn(async () =>
        state.member ? { nexconnJoinedAt: state.nexconnJoinedAt } : null,
      ),
      update: vi.fn(async ({ data }: { data: { nexconnJoinedAt: Date } }) => {
        state.nexconnJoinedAt = data.nexconnJoinedAt;
        return {};
      }),
    },
    team: {
      findUnique: vi.fn(async () => ({
        nexconnGroupReadyAt: state.groupReady ? new Date() : null,
      })),
      updateMany: vi.fn(async () => {
        state.groupReady = true;
        return { count: 1 };
      }),
    },
  };
  const db = { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { db: db as unknown as PrismaClient, state, tx };
}

function setup(
  respond: (path: string) => unknown,
  options: {
    nexconnJoinedAt?: Date | null;
    member?: boolean;
    allowCreate?: boolean;
    lockFree?: boolean;
  } = {},
) {
  const { db, state } = fakeDb(options);
  const order: string[] = [];
  const call = vi.fn(async (path: string) => {
    order.push(path);
    return respond(path);
  });
  const client = { call, currentHost: () => "h" } as unknown as NexconnClient;
  const deps: TeamChatDeps = {
    db,
    client,
    registerUser: vi.fn(async ({ userId }: { userId: string }) => {
      order.push(`token:${userId}`);
    }),
    allowGroupCreate: vi.fn(async () => options.allowCreate ?? true),
    acquireGroupLock: vi.fn(async () => options.lockFree ?? true),
    releaseGroupLock: vi.fn(async () => {}),
  };
  return { deps, order, state, call };
}

describe("ensureTeamChat", () => {
  it("registers the user, creates the group, then joins", async () => {
    const { deps, order, state } = setup(() => ({}));
    await expect(ensureTeamChat(deps, team, user)).resolves.toEqual({
      chat: "ok",
      channelId: team.nexconnChannelId,
    });
    expect(order).toEqual([
      `token:${user.nexconnUserId}`,
      "token:tollgatebot",
      "/v4/group-channel/create",
      "/v4/group-channel/join",
    ]);
    expect(state.groupReady).toBe(true);
    expect(state.nexconnJoinedAt).toBeInstanceOf(Date);
  });

  it("refuses non-members without calling Nexconn", async () => {
    const { deps, call } = setup(() => ({}), { member: false });
    await expect(ensureTeamChat(deps, team, user)).rejects.toBeInstanceOf(NotTeamMemberError);
    expect(call).not.toHaveBeenCalled();
    expect(deps.registerUser).not.toHaveBeenCalled();
  });

  it("treats 'group exists' and 'already a member' as success", async () => {
    const { deps } = setup((path) => {
      throw apiError(path.endsWith("create") ? 25409 : 25412);
    });
    await expect(ensureTeamChat(deps, team, user)).resolves.toMatchObject({ chat: "ok" });
  });

  it("skips Nexconn entirely once the user has joined", async () => {
    const { deps, call } = setup(() => ({}), { nexconnJoinedAt: new Date() });
    await expect(ensureTeamChat(deps, team, user)).resolves.toMatchObject({ chat: "ok" });
    expect(call).not.toHaveBeenCalled();
    expect(deps.registerUser).not.toHaveBeenCalled();
  });

  it("recreates a missing group once, then joins", async () => {
    let joins = 0;
    const ready = { ...team, nexconnGroupReadyAt: new Date() };
    const { deps, order } = setup((path) => {
      if (path.endsWith("join") && joins++ === 0) throw apiError(25410);
      return {};
    });
    await expect(ensureTeamChat(deps, ready, user)).resolves.toMatchObject({ chat: "ok" });
    expect(order.filter((p) => p.endsWith("create"))).toHaveLength(1);
    expect(order.filter((p) => p.endsWith("join"))).toHaveLength(2);
  });

  it("reports a full group without failing", async () => {
    const { deps, state } = setup((path) => {
      if (path.endsWith("join")) throw apiError(25411);
      return {};
    });
    await expect(ensureTeamChat(deps, team, user)).resolves.toEqual({ chat: "full" });
    expect(state.nexconnJoinedAt).toBeNull();
  });

  it("does not create a group when the daily group budget is spent", async () => {
    const { deps, call } = setup(() => ({}), { allowCreate: false });
    await expect(ensureTeamChat(deps, team, user)).rejects.toMatchObject({
      name: "ChatUnavailableError",
      reason: "group_quota",
    });
    expect(call).not.toHaveBeenCalled();
  });

  it("charges the creating user's group budget and releases the team lock", async () => {
    const { deps } = setup(() => ({}));
    await ensureTeamChat(deps, team, user);
    expect(deps.allowGroupCreate).toHaveBeenCalledWith(user.id);
    expect(deps.acquireGroupLock).toHaveBeenCalledWith(team.id);
    expect(deps.releaseGroupLock).toHaveBeenCalledWith(team.id);
  });

  it("answers busy, without spending quota, while another request creates the group", async () => {
    const { deps, call } = setup(() => ({}), { lockFree: false });
    deps.sleep = vi.fn(async () => {});
    await expect(ensureTeamChat(deps, team, user)).rejects.toMatchObject({ reason: "busy" });
    expect(deps.allowGroupCreate).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  it("skips creating when another request recorded the group meanwhile", async () => {
    const { deps, order, state } = setup(() => ({}));
    state.groupReady = true; // the row says the group exists, the passed team is stale
    await expect(ensureTeamChat(deps, team, user)).resolves.toMatchObject({ chat: "ok" });
    expect(order).not.toContain("/v4/group-channel/create");
    expect(deps.allowGroupCreate).not.toHaveBeenCalled();
  });

  it("releases the lock when the budget is spent", async () => {
    const { deps } = setup(() => ({}), { allowCreate: false });
    await expect(ensureTeamChat(deps, team, user)).rejects.toMatchObject({
      reason: "group_quota",
    });
    expect(deps.releaseGroupLock).toHaveBeenCalledWith(team.id);
  });

  it("passes other Nexconn errors up and records nothing", async () => {
    const { deps, state } = setup((path) => {
      if (path.endsWith("join")) throw apiError(1008);
      return {};
    });
    await expect(ensureTeamChat(deps, team, user)).rejects.toBeInstanceOf(NexconnApiError);
    expect(state.nexconnJoinedAt).toBeNull();
  });
});

describe("ensureTeamChat when two people open a new team together", () => {
  it("waits for the other request to create the group, then joins without creating", async () => {
    const { deps, order, state } = setup(() => ({}), { lockFree: false });
    let checks = 0;
    deps.sleep = vi.fn(async () => {
      if (++checks === 2) state.groupReady = true; // the other request finished
    });
    await expect(ensureTeamChat(deps, team, user)).resolves.toMatchObject({ chat: "ok" });
    expect(order).not.toContain("/v4/group-channel/create");
    expect(order).toContain("/v4/group-channel/join");
    expect(deps.allowGroupCreate).not.toHaveBeenCalled();
  });

  it("answers busy only after waiting, if the group still doesn't exist", async () => {
    const { deps } = setup(() => ({}), { lockFree: false });
    deps.sleep = vi.fn(async () => {});
    await expect(ensureTeamChat(deps, team, user)).rejects.toMatchObject({ reason: "busy" });
    expect(deps.sleep).toHaveBeenCalled();
  });
});
