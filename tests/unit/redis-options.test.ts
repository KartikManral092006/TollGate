import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { REDIS_URL: "redis://localhost:6379", NODE_ENV: "test" } }));

const { redisOptions } = await import("@/lib/redis");

describe("redisOptions", () => {
  it("turns on TLS for Upstash even when the URL says redis://", () => {
    expect(redisOptions("redis://default:pw@apt-ox-1.upstash.io:6379").tls).toEqual({});
  });

  it("leaves rediss:// to ioredis and local Redis without TLS", () => {
    expect(redisOptions("rediss://default:pw@apt-ox-1.upstash.io:6379").tls).toBeUndefined();
    expect(redisOptions("redis://localhost:6381").tls).toBeUndefined();
  });

  it("keeps commands from hanging", () => {
    expect(redisOptions("redis://localhost:6381")).toMatchObject({
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  });
});
