import { describe, expect, it } from "vitest";
import { currentStep, setupState } from "@/features/onboarding/shared/steps";

const fresh = { hasName: false, repoCount: 0, tokenUsed: false, gateCount: 0, memberCount: 1 };

describe("setupState", () => {
  it("starts at the name step with nothing done", () => {
    const state = setupState(fresh);
    expect(state).toMatchObject({ done: 0, total: 5, complete: false });
    expect(currentStep(state)).toBe("name");
  });

  it("moves to the first unfinished step", () => {
    const state = setupState({ ...fresh, hasName: true, repoCount: 1 });
    expect(state.done).toBe(2);
    expect(currentStep(state)).toBe("connect");
  });

  it("completes when everything is done", () => {
    const state = setupState({
      hasName: true,
      repoCount: 1,
      tokenUsed: true,
      gateCount: 3,
      memberCount: 2,
    });
    expect(state.complete).toBe(true);
    expect(currentStep(state)).toBeNull();
  });
});
