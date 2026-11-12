import { describe, expect, it } from "vitest";
import {
  activityCalendar,
  describeDevice,
  localDay,
  profileStats,
  timeline,
  topCounts,
  type ProfileGate,
  type ProfileVote,
} from "@/features/profile/shared/profile";

// Local noon on a given day, so the tests hold in any timezone.
const at = (day: string, hour = 12, sec = 0) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:${String(sec).padStart(2, "0")}`);

function gate(overrides: Partial<ProfileGate> = {}): ProfileGate {
  return {
    id: "g1",
    code: 1,
    teamId: "t1",
    teamName: "Billing",
    status: "approved",
    preset: "db-migrate",
    env: "prod",
    tool: "bash",
    command: "prisma migrate deploy",
    repo: "acme/billing",
    createdAt: at("2026-11-10").toISOString(),
    decidedAt: null,
    ...overrides,
  };
}

function vote(overrides: Partial<ProfileVote> = {}, delaySec = 60): ProfileVote {
  const created = at("2026-11-10");
  return {
    gateId: "g9",
    gateCode: 9,
    teamId: "t1",
    teamName: "Billing",
    decision: "approve",
    reason: null,
    at: new Date(created.getTime() + delaySec * 1000).toISOString(),
    gateCreatedAt: created.toISOString(),
    command: "vercel --prod",
    preset: "prod-deploy",
    env: "prod",
    requester: { id: "u2", name: "Ana" },
    ...overrides,
  };
}

describe("profileStats", () => {
  it("counts what the agent raised and how the person reviewed", () => {
    const stats = profileStats(
      [
        gate(),
        gate({ status: "approved" }),
        gate({ status: "denied" }),
        gate({ status: "asked" }),
        gate({ status: "parked" }),
      ],
      [vote({}, 2), vote({}, 60), vote({ decision: "deny" }, 120)],
    );
    expect(stats).toMatchObject({
      raised: 5,
      raisedApproved: 2,
      raisedDenied: 1,
      raisedOpen: 1,
      reviews: 3,
      approvals: 2,
      denials: 1,
      medianResponseSec: 60,
    });
    // Asked gates are neither approvals nor denials.
    expect(stats.approvalRate).toBeCloseTo(2 / 3);
    // One of two approvals came in under 3 s.
    expect(stats.quickApprovalRate).toBe(0.5);
  });

  it("leaves rates empty when there is nothing to measure", () => {
    expect(profileStats([], [])).toMatchObject({
      approvalRate: null,
      medianResponseSec: null,
      quickApprovalRate: null,
    });
  });
});

describe("topCounts", () => {
  it("ranks by count and keeps first-seen order on ties", () => {
    expect(topCounts(["a", "b", "b", "c", "a", "b"], 2)).toEqual([
      { label: "b", count: 3 },
      { label: "a", count: 2 },
    ]);
  });
});

describe("activityCalendar", () => {
  // Thursday 12 Nov 2026.
  const now = at("2026-11-12", 15).getTime();

  it("lays out Sunday-first weeks ending with the week that holds today", () => {
    const calendar = activityCalendar([], now, 4);
    expect(calendar.weeks).toHaveLength(4);
    expect(calendar.weeks.every((week) => week.length === 7)).toBe(true);
    expect(calendar.weeks[0]![0]!.date).toBe("2026-10-18");
    const last = calendar.weeks.at(-1)!;
    expect(last[0]!.date).toBe("2026-11-08");
    expect(last[4]).toMatchObject({ date: "2026-11-12", future: false });
    expect(last[5]).toMatchObject({ date: "2026-11-13", future: true });
  });

  it("shades days relative to the busiest one and counts streaks", () => {
    const times = [
      at("2026-11-12", 9),
      at("2026-11-12", 10),
      at("2026-11-12", 11),
      at("2026-11-12", 13),
      at("2026-11-11"),
      at("2026-11-02"),
      at("2026-11-03"),
      at("2026-11-04"),
    ].map((d) => d.getTime());
    const calendar = activityCalendar(times, now, 4);
    const days = calendar.weeks.flat();
    const find = (date: string) => days.find((d) => d.date === date)!;
    expect(find("2026-11-12")).toMatchObject({ count: 4, level: 4 });
    expect(find("2026-11-11")).toMatchObject({ count: 1, level: 1 });
    expect(find("2026-11-10")).toMatchObject({ count: 0, level: 0 });
    expect(calendar).toMatchObject({
      total: 8,
      activeDays: 5,
      currentStreak: 2,
      longestStreak: 3,
    });
  });

  it("keeps a streak alive through a today with no activity yet", () => {
    const times = [at("2026-11-11"), at("2026-11-10")].map((d) => d.getTime());
    expect(activityCalendar(times, now, 2).currentStreak).toBe(2);
    expect(activityCalendar([at("2026-11-09").getTime()], now, 2).currentStreak).toBe(0);
  });

  it("uses local days", () => {
    expect(localDay(at("2026-01-05", 0).getTime())).toBe("2026-01-05");
    expect(localDay(at("2026-01-05", 23).getTime())).toBe("2026-01-05");
  });
});

describe("timeline", () => {
  it("merges gates and votes newest first", () => {
    const items = timeline(
      [gate({ createdAt: at("2026-11-10", 9).toISOString() })],
      [vote({ at: at("2026-11-10", 11).toISOString() })],
    );
    expect(items.map((i) => i.kind)).toEqual(["voted", "raised"]);
  });
});

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Chrome on macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Edge on Windows",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0", "Firefox on Linux"],
    [null, "Unknown browser"],
  ])("%s", (ua, expected) => {
    expect(describeDevice(ua)).toBe(expected);
  });
});
