// Calls are billed from the moment they are created, so every call is counted at its
// worst case (maxSec) until it reports a real duration.

export const DEFAULT_MAX_CALL_SEC = 900;
// A permit whose browser never reported a callId is abandoned after this long.
export const PERMIT_STALE_MS = 2 * 60 * 1000;
// Slack for a live call that never reported its end (tab closed, phone locked).
export const END_GRACE_SEC = 60;

export type BudgetedCall = {
  status: "permitted" | "live" | "ended" | "failed";
  maxSec: number;
  durationSec: number | null;
};

export function secondsCharged(call: BudgetedCall): number {
  if (call.status === "failed") return 0;
  if (call.status === "ended") return Math.min(call.durationSec ?? call.maxSec, call.maxSec);
  return call.maxSec;
}

export function withinBudget(input: {
  calls: BudgetedCall[];
  nextMaxSec: number;
  minutesPerDay: number;
}): boolean {
  const used = input.calls.reduce((total, call) => total + secondsCharged(call), 0);
  return used + input.nextMaxSec <= input.minutesPerDay * 60;
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// The duration a client reports is never trusted past the cap it was given.
export function clampDuration(reportedSec: number, maxSec: number): number {
  if (!Number.isFinite(reportedSec) || reportedSec < 0) return 0;
  return Math.min(Math.round(reportedSec), maxSec + END_GRACE_SEC);
}
