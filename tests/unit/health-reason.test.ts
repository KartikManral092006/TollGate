import { describe, expect, it } from "vitest";
import { HealthTimeout, reasonOf } from "@/lib/health";

const err = (message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), extra);

describe("reasonOf", () => {
  it("names timeouts and Node network codes", () => {
    expect(reasonOf(new HealthTimeout("x"))).toBe("timeout");
    expect(reasonOf(err("getaddrinfo ENOTFOUND host.upstash.io", { code: "ENOTFOUND" }))).toBe(
      "ENOTFOUND",
    );
  });

  it("reads Redis reply errors without leaking anything", () => {
    expect(reasonOf(err("WRONGPASS invalid username-password pair or user is disabled."))).toBe(
      "WRONGPASS_invalid_username-password_pair_or_user_is_disabled",
    );
    expect(reasonOf(err("NOAUTH Authentication required."))).toBe("NOAUTH");
    expect(reasonOf(err("ERR max daily request limit exceeded"))).toBe(
      "ERR_max_daily_request_limit_exceeded",
    );
  });

  it("maps ioredis connection failures", () => {
    expect(reasonOf(err("Reached the max retries per request limit (which is 2)."))).toBe(
      "unreachable",
    );
    expect(reasonOf(err("Connection is closed."))).toBe("connection_closed");
  });

  it("never echoes a message that could hold a host or password", () => {
    expect(reasonOf(err("connect to rediss://default:secret@x.upstash.io failed"))).toBe("error");
  });
});
