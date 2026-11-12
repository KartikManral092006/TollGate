import type { GateView } from "./view";

// How well a team's gating works (decision time, denials, rubber stamps), computed from the
// audit rows the team can see.

// An approval this fast was almost certainly not read.
export const RUBBER_STAMP_MS = 3000;

export type GateMetrics = {
  total: number;
  open: number;
  approved: number;
  denied: number;
  // Closed with a question to the agent: not a decision, so not in the deny rate.
  asked: number;
  // Approved on arrival by a team rule: counted as approved, kept out of decision times.
  autoApproved: number;
  parked: number;
  expired: number;
  // Denied ÷ decided (approved + denied); null until something is decided.
  denyRate: number | null;
  medianDecisionSec: number | null;
  // Approvals given in under 3 s ÷ all approvals.
  rubberStampRate: number | null;
  // Parked gates later approved or denied ÷ all gates that were parked.
  parkedResolvedRate: number | null;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

export function gateMetrics(gates: GateView[]): GateMetrics {
  const count = (status: GateView["status"]) => gates.filter((g) => g.status === status).length;
  const approved = count("approved");
  const asked = gates.filter((g) => g.status === "denied" && g.question).length;
  const denied = count("denied") - asked;
  const autoApproved = gates.filter((g) => g.rule?.action === "auto_approve").length;

  const decisionSecs = gates
    .filter(
      (g) =>
        (g.status === "approved" || g.status === "denied") &&
        !g.question &&
        g.rule?.action !== "auto_approve" &&
        g.decidedAt,
    )
    .map((g) => (Date.parse(g.decidedAt!) - Date.parse(g.createdAt)) / 1000)
    .filter((sec) => sec >= 0);

  const approvals = gates.flatMap((g) =>
    g.votes
      .filter((v) => v.decision === "approve")
      .map((v) => Date.parse(v.at) - Date.parse(g.createdAt)),
  );

  const everParked = gates.filter((g) => g.parkedAt !== null);
  const parkedResolved = everParked.filter(
    (g) => g.status === "approved" || g.status === "denied",
  ).length;

  return {
    total: gates.length,
    open: count("pending") + count("parked"),
    approved,
    denied,
    asked,
    autoApproved,
    parked: count("parked"),
    expired: count("expired"),
    denyRate: ratio(denied, approved + denied),
    medianDecisionSec: median(decisionSecs),
    rubberStampRate: ratio(approvals.filter((ms) => ms < RUBBER_STAMP_MS).length, approvals.length),
    parkedResolvedRate: ratio(parkedResolved, everParked.length),
  };
}

const CSV_COLUMNS = [
  "code",
  "status",
  "env",
  "preset",
  "repo",
  "branch",
  "command",
  "agent_reason",
  "requester",
  "quorum",
  "approvals",
  "votes",
  "deny_reason",
  "question",
  "created_at",
  "decided_at",
  "redactions",
  "ran",
  "exit_code",
] as const;

// RFC 4180 quoting, plus a leading ' on values a spreadsheet would run as a formula.
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function gatesToCsv(gates: GateView[]): string {
  const rows = gates.map((g) =>
    [
      `TG-${g.code}`,
      g.status,
      g.env,
      g.preset,
      g.repo,
      g.branch,
      g.command,
      g.intent,
      g.requester.name,
      g.quorum,
      g.approvals,
      g.votes.map((v) => `${v.name}: ${v.decision}${v.reason ? ` (${v.reason})` : ""}`).join("; "),
      g.question ? null : g.denyReason,
      g.question,
      g.createdAt,
      g.decidedAt,
      g.redactions,
      g.ran?.outcome ?? null,
      g.ran?.exitCode ?? null,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

export type DailySeries = {
  days: string[]; // local dates, oldest first, "2026-11-04"
  gates: number[];
  medianDecisionSec: (number | null)[];
  denyRate: (number | null)[];
  rubberStampRate: (number | null)[];
};

const localDay = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// The audit stats for each of the last `count` days (by when the gate was raised), for the
// sparklines under them. A day with nothing to measure is null, drawn as a gap.
export function dailySeries(gates: GateView[], now: number, count = 12): DailySeries {
  const days = Array.from({ length: count }, (_, i) =>
    localDay(now - (count - 1 - i) * 86_400_000),
  );
  const byDay = new Map<string, GateView[]>(days.map((day) => [day, []]));
  for (const gate of gates) byDay.get(localDay(Date.parse(gate.createdAt)))?.push(gate);
  const metrics = days.map((day) => gateMetrics(byDay.get(day)!));
  return {
    days,
    gates: metrics.map((m) => m.total),
    medianDecisionSec: metrics.map((m) => m.medianDecisionSec),
    denyRate: metrics.map((m) => m.denyRate),
    rubberStampRate: metrics.map((m) => m.rubberStampRate),
  };
}
