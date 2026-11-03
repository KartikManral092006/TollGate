import "server-only";
import { Redis, type RedisOptions } from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

// Upstash only accepts TLS, but its console also shows a plain redis:// URL (inside a
// `redis-cli --tls` command). Turn TLS on for Upstash hosts whichever form was pasted.
export function redisOptions(url: string): RedisOptions {
  const options: RedisOptions = { maxRetriesPerRequest: 2, lazyConnect: true };
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === "redis:" && hostname.endsWith(".upstash.io")) options.tls = {};
  } catch {
    // The env schema already validated the URL.
  }
  return options;
}

let lastError: { code: string; at: number } | null = null;

// The connection error behind a failed command (ioredis only reports "max retries"), as a
// short code for the health check. Never the message: it can contain the host.
export function lastRedisError(): string | null {
  return lastError && Date.now() - lastError.at < 60_000 ? lastError.code : null;
}

function createRedis(): Redis {
  const client = new Redis(env.REDIS_URL, redisOptions(env.REDIS_URL));
  client.on("error", (error: Error & { code?: unknown }) => {
    const fromMessage = /\b(WRONGPASS|NOAUTH|NOPERM)\b/.exec(error.message)?.[1];
    const code = typeof error.code === "string" ? error.code : (fromMessage ?? "connection_error");
    lastError = { code: code.slice(0, 32), at: Date.now() };
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
