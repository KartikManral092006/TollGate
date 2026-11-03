import { describe, expect, it } from "vitest";
import { csvCell, gateMetrics, gatesToCsv, median } from "@/features/gates/shared/metrics";
import type { GateView } from "@/features/gates/shared/view";

const at = (sec: number) => new Date(Date.UTC(2026, 10, 3, 9, 0, sec)).toISOString();

function gate(patch: Partial<GateView>): GateView {
  return {
    id: "g",
    code: 1,
    status: "pending",
    preset: "publish",
    env: "prod",
    repo: "acme/x",
    mode: "guard",
    branch: "main",
    command: "npm publish",
    context: "",
    intent: null,
    redactions: 0,
    quorum: 1,
    approvals: 0,
    requester: { id: "r", name: "Kartik" },
    votes: [],
    denyReason: null,
    decidedAt: null,
    parkedAt: null,
    grant: null,
    calls: [],
    createdAt: at(0),
    ...patch,
  };
}

const approve = (sec: number) => ({
  userId: "a",
  name: "Ana",
  decision: "approve" as const,
  reason: null,
  at: at(sec),
});

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("gateMetrics", () => {
  it("returns nulls for an empty team", () => {
    expect(gateMetrics([])).toMatchObject({
      total: 0,
      denyRate: null,
      medianDecisionSec: null,
      rubberStampRate: null,
      parkedResolvedRate: null,
    });
  });

  it("computes counts, deny rate, median decision time and rubber stamps", () => {
    const metrics = gateMetrics([
      gate({ status: "approved", decidedAt: at(2), votes: [approve(2)] }),
      gate({ status: "approved", decidedAt: at(60), votes: [approve(60)] }),
      gate({ status: "denied", decidedAt: at(30) }),
      gate({ status: "pending" }),
      gate({ status: "parked", parkedAt: at(45) }),
      gate({ status: "approved", parkedAt: at(45), decidedAt: at(50), votes: [approve(50)] }),
    ]);
    expect(metrics).toMatchObject({ total: 6, open: 2, approved: 3, denied: 1, parked: 1 });
    expect(metrics.denyRate).toBeCloseTo(0.25);
    expect(metrics.medianDecisionSec).toBe(40);
    expect(metrics.rubberStampRate).toBeCloseTo(1 / 3);
    expect(metrics.parkedResolvedRate).toBe(0.5);
  });
});

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-rf /")).toBe("'-rf /");
  });

  it("writes a header and one row per gate", () => {
    const csv = gatesToCsv([gate({ code: 17, status: "denied", denyReason: "back up first" })]);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("code,status,env");
    expect(row).toContain("TG-17,denied,prod");
    expect(row).toContain("back up first");
  });
});
