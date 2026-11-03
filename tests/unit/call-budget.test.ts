import { describe, expect, it } from "vitest";
import {
  clampDuration,
  secondsCharged,
  startOfUtcDay,
  withinBudget,
} from "@/features/call/shared/budget";

describe("secondsCharged", () => {
  it("charges open calls at their cap and ended calls at their real length", () => {
    expect(secondsCharged({ status: "permitted", maxSec: 900, durationSec: null })).toBe(900);
    expect(secondsCharged({ status: "live", maxSec: 900, durationSec: null })).toBe(900);
    expect(secondsCharged({ status: "ended", maxSec: 900, durationSec: 120 })).toBe(120);
    expect(secondsCharged({ status: "failed", maxSec: 900, durationSec: null })).toBe(0);
  });

  it("never charges an ended call past its cap", () => {
    expect(secondsCharged({ status: "ended", maxSec: 900, durationSec: 5000 })).toBe(900);
  });
});

describe("withinBudget", () => {
  it("allows a call that fits and refuses one that doesn't", () => {
    const calls = [{ status: "ended" as const, maxSec: 3000, durationSec: 2400 }];
    expect(withinBudget({ calls, nextMaxSec: 900, minutesPerDay: 60 })).toBe(true);
    expect(withinBudget({ calls, nextMaxSec: 1300, minutesPerDay: 60 })).toBe(false);
  });

  it("refuses everything when the budget is 0", () => {
    expect(withinBudget({ calls: [], nextMaxSec: 1, minutesPerDay: 0 })).toBe(false);
  });
});

describe("clampDuration", () => {
  it("caps client reports and rejects nonsense", () => {
    expect(clampDuration(100.4, 900)).toBe(100);
    expect(clampDuration(99_999, 900)).toBe(960);
    expect(clampDuration(-5, 900)).toBe(0);
    expect(clampDuration(Number.NaN, 900)).toBe(0);
  });
});

describe("startOfUtcDay", () => {
  it("truncates to UTC midnight", () => {
    expect(startOfUtcDay(new Date("2026-11-03T23:59:59.000Z")).toISOString()).toBe(
      "2026-11-03T00:00:00.000Z",
    );
  });
});
