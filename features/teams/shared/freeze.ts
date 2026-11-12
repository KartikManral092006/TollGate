// Freeze and incident mode: for a while, nothing is approved automatically and production asks
// for more. Pure, so the rules are unit-tested; the server applies them when a gate is raised
// and when someone votes.
//
// While a team is frozen:
//   - team rules and approval windows don't approve anything on arrival, and new windows can't
//     be opened;
//   - a production gate needs two approvals, or one from an owner (never fewer than its preset
//     asks, and never more than the people who can vote on it, so it can't get stuck).
// A gate keeps the rules it was raised under, even if the freeze ends while it waits.

export const FREEZE_KINDS = ["incident", "freeze"] as const;
export type FreezeKind = (typeof FREEZE_KINDS)[number];

export const FREEZE_MINUTES = [60, 240, 1440, 4320] as const;
export type FreezeMinutes = (typeof FREEZE_MINUTES)[number];

export const FREEZE_REASON_MAX = 200;
export const FROZEN_PROD_QUORUM = 2;

export type FreezeView = {
  kind: FreezeKind;
  reason: string | null;
  until: string;
  startedAt: string;
  by: string;
};

export type FreezeColumns = {
  freezeKind: string | null;
  freezeReason: string | null;
  freezeUntil: Date | null;
  freezeStartedAt: Date | null;
};

export function isFrozen(
  team: Pick<FreezeColumns, "freezeUntil">,
  now: Date = new Date(),
): boolean {
  return team.freezeUntil !== null && team.freezeUntil.getTime() > now.getTime();
}

export function freezeView(
  team: FreezeColumns,
  by: string | null,
  now: Date = new Date(),
): FreezeView | null {
  if (!isFrozen(team, now) || !team.freezeUntil) return null;
  return {
    kind: team.freezeKind === "incident" ? "incident" : "freeze",
    reason: team.freezeReason,
    until: team.freezeUntil.toISOString(),
    startedAt: (team.freezeStartedAt ?? now).toISOString(),
    by: by?.trim() || "A teammate",
  };
}

// The quorum a gate raised during a freeze needs. `voters`: people who could approve it (not
// the requester).
export function frozenQuorum(input: { quorum: number; env: string; voters: number }): number {
  if (input.env !== "prod") return input.quorum;
  const raised = Math.max(input.quorum, FROZEN_PROD_QUORUM);
  return Math.max(input.quorum, Math.min(raised, Math.max(1, input.voters)));
}

export function freezeLabel(kind: FreezeKind): string {
  return kind === "incident" ? "Incident mode" : "Freeze";
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
  return `${minutes / 1440} ${minutes === 1440 ? "day" : "days"}`;
}
