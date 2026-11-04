import { canHaveRule } from "@/features/insights/shared/policy";

// Time-limited approvals ("approve the same for 2 hours"). Asking about every staging migration
// in an afternoon of work teaches people to approve without reading; a short window that a
// person opens on purpose, for one teammate's agent, is the honest middle ground between that
// and a permanent team rule.

export const WINDOW_MINUTES = [30, 60, 120, 240] as const;
export type WindowMinutes = (typeof WINDOW_MINUTES)[number];

// The same limits as team rules (never production, never presets whose mistakes can't be
// undone), and never where the team asked for two people: one approver can't stand in for
// a second one for hours.
export function canOpenWindow(gate: { preset: string; env: string; quorum: number }): boolean {
  return gate.quorum === 1 && canHaveRule(gate.preset, gate.env);
}

// Clients can vote on what they were invited to, but not hand out approvals in advance.
export function roleCanOpenWindow(role: string): boolean {
  return role === "owner" || role === "approver";
}

// What a window covers, in words: "db-migrate on staging", or just "db-migrate" when the gate
// names no environment (stored as "other"). Production never has a window.
export function windowKind(gate: { preset: string; env: string }): string {
  return gate.env === "staging" ? `${gate.preset} on staging` : gate.preset;
}

export function windowLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} minutes` : minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
}
