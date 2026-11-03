import { describe, expect, it } from "vitest";
import type { GateView } from "@/features/gates/shared/view";
import { reviewQueue } from "@/features/review/components/review-client";

const gate = (id: string, status: GateView["status"], minute: number) =>
  ({ id, status, createdAt: new Date(Date.UTC(2026, 10, 4, 9, minute)).toISOString() }) as GateView;

describe("reviewQueue", () => {
  it("keeps open gates only, oldest first", () => {
    const queue = reviewQueue([
      gate("new", "pending", 30),
      gate("done", "approved", 1),
      gate("old", "parked", 5),
      gate("mid", "pending", 10),
      gate("gone", "expired", 2),
    ]);
    expect(queue.map((g) => g.id)).toEqual(["old", "mid", "new"]);
  });
});
