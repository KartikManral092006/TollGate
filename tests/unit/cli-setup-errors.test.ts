import { describe, expect, it } from "vitest";
import { ApiError, describeSetupError } from "@/packages/cli/src/api";

const server = "https://tollgate.test";

function networkError(code: string): TypeError {
  return new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) });
}

describe("describeSetupError", () => {
  it("explains a rejected token instead of printing '401 unauthorized'", () => {
    expect(describeSetupError(new ApiError(401, "unauthorized"), server)).toMatch(
      /rejected this token/,
    );
  });

  it("names the wait when the server doesn't answer in time", () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    expect(describeSetupError(timeout, server, 20_000)).toBe(
      "https://tollgate.test didn't answer within 20 s. Check the URL and your network, then try again.",
    );
  });

  it("points at the --server URL when the host doesn't resolve", () => {
    expect(describeSetupError(networkError("ENOTFOUND"), server)).toMatch(/Check the --server URL/);
  });

  it("keeps the network code for other connection failures", () => {
    expect(describeSetupError(networkError("ECONNREFUSED"), server)).toMatch(/ECONNREFUSED/);
  });

  it("reports rate limits and server errors plainly", () => {
    expect(describeSetupError(new ApiError(429, "rate_limited"), server)).toMatch(/Too many/);
    expect(describeSetupError(new ApiError(503, "error"), server)).toMatch(/had an error \(503\)/);
  });
});
