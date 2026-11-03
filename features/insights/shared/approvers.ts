import type { HistoryGate, SuggestedApprover } from "./types";

// Who usually decides this kind of gate, so the requester (or a teammate) knows whom to ring
// or nudge. Read from votes on the team's recent decisions; no presence or timezone data.

const RECENT = 20;
const MIN_DECISIONS = 2;

export type ApproverCandidate = { id: string; name: string; canVote: boolean };

export function suggestApprovers(
  gate: {
    id: string;
    repo: string;
    preset: string;
    createdAt: string;
    requester: { id: string };
    votes: { userId: string }[];
  },
  history: HistoryGate[],
  members: ApproverCandidate[],
): SuggestedApprover[] {
  const eligible = new Map(
    members
      .filter(
        (m) =>
          m.canVote &&
          m.id !== gate.requester.id &&
          !gate.votes.some((vote) => vote.userId === m.id),
      )
      .map((m) => [m.id, m.name]),
  );
  if (eligible.size === 0) return [];

  const before = Date.parse(gate.createdAt);
  const inRepo = history.filter(
    (h) => h.repo === gate.repo && h.id !== gate.id && Date.parse(h.createdAt) < before,
  );
  // This kind of command in this repo first; the repo as a whole if that's too thin.
  const scopes = [
    { scope: "preset" as const, gates: inRepo.filter((h) => h.preset === gate.preset) },
    { scope: "repo" as const, gates: inRepo },
  ];

  for (const { scope, gates } of scopes) {
    const recent = gates.slice(0, RECENT);
    const counts = new Map<string, number>();
    for (const past of recent) {
      for (const vote of past.votes) {
        if (eligible.has(vote.userId)) counts.set(vote.userId, (counts.get(vote.userId) ?? 0) + 1);
      }
    }
    const ranked = [...counts.entries()]
      .filter(([, count]) => count >= MIN_DECISIONS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    if (ranked.length > 0) {
      return ranked.map(([userId, decided]) => ({
        userId,
        name: eligible.get(userId)!,
        decided,
        of: recent.length,
        scope,
      }));
    }
  }
  return [];
}
