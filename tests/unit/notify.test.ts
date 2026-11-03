import { describe, expect, it, vi } from "vitest";
import {
  notifyGateWaiting,
  notifyParkedDecision,
  type NotifyDeps,
} from "@/features/notify/server/notify";
import {
  escapeHtml,
  gateWaitingNotice,
  parkedDecisionNotice,
} from "@/features/notify/shared/messages";
import type { NexconnClient } from "@/features/nexconn/server/client";
import type { PrismaClient } from "@/lib/generated/prisma/client";

const base = {
  code: 17,
  env: "prod",
  preset: "db-migrate",
  repo: "acme/billing",
  command: "npx prisma migrate deploy",
  requester: "Kartik",
  quorum: 2,
  url: "https://t.example/teams/T?gate=G",
};

describe("notice copy", () => {
  it("says who, what, where and links to the gate", () => {
    const notice = gateWaitingNotice(base);
    expect(notice.subject).toBe("TG-17 is waiting on you (acme/billing)");
    expect(notice.chat).toContain("Kartik's agent wants to run db-migrate on PROD");
    expect(notice.text).toContain("Approve or deny: https://t.example/teams/T?gate=G");
    expect(notice.push.length).toBeLessThanOrEqual(120);
  });

  it("escapes the command in HTML email", () => {
    const notice = gateWaitingNotice({ ...base, command: '<img src=x onerror="alert(1)">' });
    expect(notice.html).not.toContain("<img");
    expect(notice.html).toContain("&lt;img");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("tells a requester to retry after a parked approval, or why it was denied", () => {
    expect(
      parkedDecisionNotice({ code: 16, approved: true, decider: "Ana", reason: null, url: "u" })
        .subject,
    ).toBe("TG-16 approved: retry now");
    expect(
      parkedDecisionNotice({
        code: 16,
        approved: false,
        decider: "Ana",
        reason: "back up first",
        url: "u",
      }).chat,
    ).toContain("denied by Ana: back up first");
  });
});

function deps(
  gate: Record<string, unknown> | null,
  voters: { id: string; nexconn: string | null }[],
) {
  const sent: { toUserIds: string[]; pushContent?: string }[] = [];
  const emails: string[] = [];
  const db = {
    gate: { findUnique: vi.fn(async () => gate) },
    membership: {
      findMany: vi.fn(async () =>
        voters.map((v) => ({
          user: { id: v.id, email: `${v.id}@x.test`, nexconnUserId: v.nexconn },
        })),
      ),
    },
    user: { findUnique: vi.fn(async () => ({ id: "A", name: "Ana" })) },
  } as unknown as PrismaClient;
  const client = {
    call: vi.fn(async (_path: string, body: { toUserIds: string[]; pushContent?: string }) => {
      sent.push(body);
      return { messageIds: [] };
    }),
  } as unknown as NexconnClient;
  const result: NotifyDeps = {
    db,
    nexconn: client,
    gateUrl: (t, g) => `https://t.example/teams/${t}?gate=${g}`,
    email: vi.fn(async (to) => {
      emails.push(to.address);
      return true;
    }),
  };
  return { deps: result, sent, emails, db };
}

const gate = {
  id: "G",
  code: 17,
  teamId: "T",
  status: "pending",
  env: "prod",
  preset: "publish",
  command: "npm publish",
  quorum: 1,
  requesterId: "K",
  repo: { name: "acme/x" },
  requester: { id: "K", name: "Kartik", email: "k@x.test", nexconnUserId: "K" },
  parkedAt: null,
  decidedById: null,
  denyReason: null,
};

describe("notifyGateWaiting", () => {
  it("messages and emails every voter but never the requester", async () => {
    const {
      deps: d,
      sent,
      emails,
      db,
    } = deps(gate, [
      { id: "A", nexconn: "A" },
      { id: "B", nexconn: null },
    ]);
    await notifyGateWaiting(d, "G");
    expect(vi.mocked(db.membership.findMany).mock.calls[0]![0]).toMatchObject({
      where: { userId: { not: "K" } },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.toUserIds).toEqual(["A"]);
    expect(emails.sort()).toEqual(["A@x.test", "B@x.test"]);
  });

  it("does nothing for a gate that is already decided", async () => {
    const {
      deps: d,
      sent,
      emails,
    } = deps({ ...gate, status: "approved" }, [{ id: "A", nexconn: "A" }]);
    await notifyGateWaiting(d, "G");
    expect(sent).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });

  it("still emails when Nexconn isn't configured", async () => {
    const { deps: d, emails } = deps(gate, [{ id: "A", nexconn: "A" }]);
    await notifyGateWaiting({ ...d, nexconn: null }, "G");
    expect(emails).toEqual(["A@x.test"]);
  });
});

describe("notifyParkedDecision", () => {
  it("tells the requester only about gates that had been parked", async () => {
    const parked = { ...gate, status: "approved", parkedAt: new Date(), decidedById: "A" };
    const one = deps(parked, []);
    await notifyParkedDecision(one.deps, "G");
    expect(one.sent[0]!.toUserIds).toEqual(["K"]);
    expect(one.emails).toEqual(["k@x.test"]);

    const live = deps({ ...parked, parkedAt: null }, []);
    await notifyParkedDecision(live.deps, "G");
    expect(live.sent).toHaveLength(0);
    expect(live.emails).toHaveLength(0);
  });
});
