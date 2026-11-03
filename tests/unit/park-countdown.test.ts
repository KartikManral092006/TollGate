import { describe, expect, it } from "vitest";
import { parkLabel } from "@/features/room/components/park-countdown";

describe("parkLabel", () => {
  it("counts down in minutes and seconds", () => {
    expect(parkLabel(222_000)).toBe("Parks in 3:42");
    expect(parkLabel(5_200)).toBe("Parks in 0:06");
    expect(parkLabel(60_000)).toBe("Parks in 1:00");
  });

  it("says it is parking once time is up", () => {
    expect(parkLabel(0)).toBe("Parking…");
    expect(parkLabel(-3000)).toBe("Parking…");
  });
});
