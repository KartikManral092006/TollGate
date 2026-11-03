import type { GateView } from "./view";

// The success metrics from PLAN.md §12, computed from the audit rows a team can see.

// An approval this fast was almost certainly not read.
export const RUBBER_STAMP_MS = 3000;

export type GateMetrics = {
  total: number;
  open: number;
  approved: number;
  denied: number;
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
  const denied = count("denied");

  const decisionSecs = gates
    .filter((g) => (g.status === "approved" || g.status === "denied") && g.decidedAt)
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
  "requester",
  "quorum",
  "approvals",
  "votes",
  "deny_reason",
  "created_at",
  "decided_at",
  "redactions",
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
      g.requester.name,
      g.quorum,
      g.approvals,
      g.votes.map((v) => `${v.name}: ${v.decision}${v.reason ? ` (${v.reason})` : ""}`).join("; "),
      g.denyReason,
      g.createdAt,
      g.decidedAt,
      g.redactions,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}
