import { describe, expect, it } from "vitest";
import { parseExtra } from "@/features/call/client/use-calls";

describe("parseExtra", () => {
  it("reads the gate and permit a caller attached", () => {
    const raw = JSON.stringify({ permitId: "p1", gateId: "g1", code: 17, kind: "ring" });
    expect(parseExtra(raw)).toEqual({ permitId: "p1", gateId: "g1", code: 17, kind: "ring" });
  });

  it("fills missing gate fields with null", () => {
    expect(parseExtra(JSON.stringify({ permitId: "p1", kind: "huddle" }))).toEqual({
      permitId: "p1",
      gateId: null,
      code: null,
      kind: "huddle",
    });
  });

  it("ignores anything else a caller might send", () => {
    expect(parseExtra(undefined)).toBeNull();
    expect(parseExtra("not json")).toBeNull();
    expect(parseExtra(JSON.stringify({ permitId: 5, kind: "ring" }))).toBeNull();
    expect(parseExtra(JSON.stringify({ permitId: "p", kind: "video" }))).toBeNull();
  });
});
