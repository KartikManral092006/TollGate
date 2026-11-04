import { median } from "@/features/gates/shared/metrics";

// Rules suggested from the team's own decisions. When a kind of command in a repo is approved
// every time, asking two people (or anyone) adds wait without adding judgment, and a high
// share of instant approvals says nobody is reading. The owner decides; Tollgate only offers,
// never for production, never for presets whose mistakes can't be undone, and never without
// enough decisions to go on.

export const WINDOW_DAYS = 30;
export const MIN_DECISIONS = 10;
const FAST_MS = 3000;
// Mistakes here can't be redeployed away, or would switch the gate itself off: always a
// human decision.
const NEVER = new Set(["destructive-fs", "infra", "publish", "guard-config", "mcp-risky"]);

export type PolicyActionValue = "one_approval" | "auto_approve";

export type PolicyHistoryGate = {
  repoId: string;
  repo: string;
  preset: string;
  env: string;
  status: "approved" | "denied";
  quorum: number;
  createdAt: string;
  decidedAt: string | null;
  // Milliseconds from the gate's creation to each approval.
  approvalMs: number[];
};

export type ExistingRule = {
  repoId: string;
  preset: string;
  env: string;
  action: PolicyActionValue;
};

export type PolicySuggestion = {
  key: string; // "preset:env:action", what a dismissal stores
  repoId: string;
  repo: string;
  preset: string;
  env: string;
  action: PolicyActionValue;
  decided: number;
  medianSec: number | null;
  // Approvals given in under 3 s ÷ all approvals.
  fastShare: number;
};

export function suggestionKey(preset: string, env: string, action: PolicyActionValue): string {
  return `${preset}:${env}:${action}`;
}

export function canHaveRule(preset: string, env: string): boolean {
  return env !== "prod" && !NEVER.has(preset);
}

export function suggestPolicies(
  history: PolicyHistoryGate[],
  rules: ExistingRule[],
  dismissed: Record<string, string[]>,
): PolicySuggestion[] {
  const groups = new Map<string, PolicyHistoryGate[]>();
  for (const gate of history) {
    if (!canHaveRule(gate.preset, gate.env)) continue;
    const id = `${gate.repoId}\u0000${gate.preset}\u0000${gate.env}`;
    groups.set(id, [...(groups.get(id) ?? []), gate]);
  }

  const suggestions: PolicySuggestion[] = [];
  for (const gates of groups.values()) {
    const { repoId, repo, preset, env } = gates[0]!;
    if (gates.length < MIN_DECISIONS || gates.some((g) => g.status === "denied")) continue;

    const rule = rules.find((r) => r.repoId === repoId && r.preset === preset && r.env === env);
    if (rule?.action === "auto_approve") continue;
    // Two approvals first becomes one; only then is skipping people offered.
    const needsTwo = gates.some((g) => g.quorum >= 2);
    const action: PolicyActionValue = needsTwo && !rule ? "one_approval" : "auto_approve";
    const key = suggestionKey(preset, env, action);
    if (dismissed[repoId]?.includes(key)) continue;

    const approvals = gates.flatMap((g) => g.approvalMs);
    suggestions.push({
      key,
      repoId,
      repo,
      preset,
      env,
      action,
      decided: gates.length,
      medianSec: median(
        gates
          .filter((g) => g.decidedAt)
          .map((g) => (Date.parse(g.decidedAt!) - Date.parse(g.createdAt)) / 1000),
      ),
      fastShare:
        approvals.length === 0
          ? 0
          : approvals.filter((ms) => ms < FAST_MS).length / approvals.length,
    });
  }
  return suggestions.sort((a, b) => b.decided - a.decided);
}

// What a rule does to a new gate. Production is checked again here, from the command itself,
// so a rule can never reach a prod command whatever env the hook reported.
export function applyRule(
  rule: { action: PolicyActionValue } | null,
  gate: { env: string; commandLooksProd: boolean; quorum: number },
): { quorum: number; autoApprove: boolean } {
  if (!rule || gate.env === "prod" || gate.commandLooksProd) {
    return { quorum: gate.quorum, autoApprove: false };
  }
  return rule.action === "auto_approve"
    ? { quorum: gate.quorum, autoApprove: true }
    : { quorum: 1, autoApprove: false };
}
