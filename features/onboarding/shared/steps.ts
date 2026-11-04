// The five things a new team needs before Tollgate protects anything, worked out from real
// data so the guide ticks itself off as the user goes.

export type SetupStepId = "name" | "repo" | "connect" | "gate" | "invite";

export type SetupState = {
  steps: Record<SetupStepId, boolean>;
  done: number;
  total: number;
  complete: boolean;
  memberCount: number;
  // The viewer's own oldest gate still waiting: what an invited teammate would decide first.
  waitingGate: { id: string; code: number } | null;
};

export const SETUP_ORDER: SetupStepId[] = ["name", "repo", "connect", "gate", "invite"];

export function setupState(facts: {
  hasName: boolean;
  repoCount: number;
  tokenUsed: boolean;
  gateCount: number;
  memberCount: number;
  // Someone voted on a gate they didn't request. Joining isn't the point: a second person
  // deciding is, so a teammate who joins and never votes leaves this step open.
  outsideVote: boolean;
  waitingGate?: { id: string; code: number } | null;
}): SetupState {
  const steps: Record<SetupStepId, boolean> = {
    name: facts.hasName,
    repo: facts.repoCount > 0,
    connect: facts.tokenUsed,
    gate: facts.gateCount > 0,
    invite: facts.outsideVote,
  };
  const done = SETUP_ORDER.filter((id) => steps[id]).length;
  return {
    steps,
    done,
    total: SETUP_ORDER.length,
    complete: done === SETUP_ORDER.length,
    memberCount: facts.memberCount,
    waitingGate: facts.waitingGate ?? null,
  };
}

// The step to show open: the first one not done yet.
export function currentStep(state: SetupState): SetupStepId | null {
  return SETUP_ORDER.find((id) => !state.steps[id]) ?? null;
}
