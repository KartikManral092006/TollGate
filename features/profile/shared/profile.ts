// A person's profile: what their agent asked for and how they reviewed teammates' gates.
// Plain JSON from the server; the calendar and streaks are worked out in the browser so days
// follow the viewer's own timezone.

import type { GateDisplayStatus } from "@/features/gates/shared/view";
import { RUBBER_STAMP_MS, median } from "@/features/gates/shared/metrics";

export type ProfileTeam = {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
};

// A gate this person's agent raised.
export type ProfileGate = {
  id: string;
  code: number;
  teamId: string;
  teamName: string;
  status: GateDisplayStatus;
  preset: string;
  env: string;
  tool: string;
  command: string;
  repo: string;
  createdAt: string;
  decidedAt: string | null;
};

// A vote this person cast on a teammate's gate.
export type ProfileVote = {
  gateId: string;
  gateCode: number;
  teamId: string;
  teamName: string;
  decision: "approve" | "deny";
  reason: string | null;
  at: string;
  gateCreatedAt: string;
  command: string;
  preset: string;
  env: string;
  requester: { id: string; name: string };
};

// Only on your own profile.
export type ProfileToken = {
  id: string;
  prefix: string;
  repo: string;
  teamId: string;
  teamName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type ProfileSession = {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

export type ProfileView = {
  user: { id: string; name: string; email: string | null; memberSince: string };
  isSelf: boolean;
  // Who is looking, so their own gates read "your TG-12".
  viewerId: string;
  // Teams in view: all of yours on your own profile, the shared ones on a teammate's.
  teams: ProfileTeam[];
  gates: ProfileGate[];
  votes: ProfileVote[];
  // True when there was more history than the page loads.
  truncated: boolean;
  tokens: ProfileToken[] | null;
  sessions: ProfileSession[] | null;
};

export type ProfileStats = {
  raised: number;
  raisedApproved: number;
  raisedDenied: number;
  raisedOpen: number;
  // Approved ÷ (approved + denied) for gates their agent raised; null until one is decided.
  approvalRate: number | null;
  reviews: number;
  approvals: number;
  denials: number;
  // From a gate appearing to this person's vote on it.
  medianResponseSec: number | null;
  // Approvals given in under 3 s ÷ all their approvals: likely not read.
  quickApprovalRate: number | null;
};

export function profileStats(gates: ProfileGate[], votes: ProfileVote[]): ProfileStats {
  const approved = gates.filter((g) => g.status === "approved").length;
  const denied = gates.filter((g) => g.status === "denied").length;
  const approvals = votes.filter((v) => v.decision === "approve");
  const responseMs = votes
    .map((v) => Date.parse(v.at) - Date.parse(v.gateCreatedAt))
    .filter((ms) => ms >= 0);
  const approvalMs = approvals
    .map((v) => Date.parse(v.at) - Date.parse(v.gateCreatedAt))
    .filter((ms) => ms >= 0);
  const medianMs = median(responseMs);
  return {
    raised: gates.length,
    raisedApproved: approved,
    raisedDenied: denied,
    raisedOpen: gates.filter((g) => g.status === "pending" || g.status === "parked").length,
    approvalRate: approved + denied === 0 ? null : approved / (approved + denied),
    reviews: votes.length,
    approvals: approvals.length,
    denials: votes.length - approvals.length,
    medianResponseSec: medianMs === null ? null : medianMs / 1000,
    quickApprovalRate:
      approvalMs.length === 0
        ? null
        : approvalMs.filter((ms) => ms < RUBBER_STAMP_MS).length / approvalMs.length,
  };
}

// The most common values, most frequent first; ties keep first-seen order.
export function topCounts(values: string[], limit = 5): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function localDay(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type CalendarDay = {
  date: string; // local "2026-11-12"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

export type ActivityCalendar = {
  // Columns of seven days, Sunday first, oldest week first; the last column holds today.
  weeks: CalendarDay[][];
  total: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
};

function startOfLocalDay(time: number): Date {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  // Calendar arithmetic, not 86 400 000 ms steps, so DST changes don't skip or repeat a day.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// One square per day for the last `weeks` weeks, shaded by how many gates and reviews it had.
export function activityCalendar(times: number[], now: number, weeks = 26): ActivityCalendar {
  const today = startOfLocalDay(now);
  const first = addDays(today, -today.getDay() - (weeks - 1) * 7);
  const counts = new Map<string, number>();
  for (const time of times) {
    const day = localDay(time);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const todayKey = localDay(today.getTime());
  const days: CalendarDay[] = [];
  let future = false;
  for (let i = 0; i < weeks * 7; i++) {
    const date = localDay(addDays(first, i).getTime());
    days.push({ date, count: future ? 0 : (counts.get(date) ?? 0), level: 0, future });
    if (date === todayKey) future = true;
  }
  const max = Math.max(0, ...days.map((d) => d.count));
  for (const day of days) {
    day.level =
      day.count === 0
        ? 0
        : (Math.min(4, Math.max(1, Math.ceil((day.count / max) * 4))) as CalendarDay["level"]);
  }

  // Streaks over every active day ever, not just the visible weeks.
  const active = new Set(counts.keys());
  let longest = 0;
  for (const day of active) {
    const previous = localDay(addDays(new Date(`${day}T12:00:00`), -1).getTime());
    if (active.has(previous)) continue;
    let length = 0;
    let cursor = new Date(`${day}T12:00:00`);
    while (active.has(localDay(cursor.getTime()))) {
      length++;
      cursor = addDays(cursor, 1);
    }
    longest = Math.max(longest, length);
  }
  // A streak still counts today if yesterday was active and today hasn't happened yet.
  let current = 0;
  let cursor = active.has(todayKey) ? today : addDays(today, -1);
  while (active.has(localDay(cursor.getTime()))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const columns: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) columns.push(days.slice(w * 7, w * 7 + 7));
  const visible = days.filter((d) => !d.future);
  return {
    weeks: columns,
    total: visible.reduce((sum, d) => sum + d.count, 0),
    activeDays: visible.filter((d) => d.count > 0).length,
    currentStreak: current,
    longestStreak: longest,
  };
}

export type TimelineItem =
  | { kind: "raised"; at: string; gate: ProfileGate }
  | { kind: "voted"; at: string; vote: ProfileVote };

// Gates raised and votes cast, newest first.
export function timeline(gates: ProfileGate[], votes: ProfileVote[], limit = 30): TimelineItem[] {
  const items: TimelineItem[] = [
    ...gates.map((gate) => ({ kind: "raised" as const, at: gate.createdAt, gate })),
    ...votes.map((vote) => ({ kind: "voted" as const, at: vote.at, vote })),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

// "Chrome on macOS" from a user agent; enough to recognise your own browsers.
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown browser";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|undici/i.test(ua)
              ? "A script"
              : "A browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return os ? `${browser} on ${os}` : browser;
}
