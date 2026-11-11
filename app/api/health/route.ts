import { connection } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HealthTimeout, reasonOf } from "@/lib/health";
import { logger } from "@/lib/logger";
import { lastRedisError, redis } from "@/lib/redis";

type CheckStatus = "ok" | "down";
type CheckResult = { status: CheckStatus; reason?: string };

// Generous: on a cold serverless start Neon wakes from scale-to-zero and Redis needs a fresh
// TLS connection.
const TIMEOUT_MS = 5000;

async function check(name: string, probe: () => Promise<unknown>): Promise<CheckResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new HealthTimeout(`${name} timed out after ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([probe(), timeout]);
    return { status: "ok" };
  } catch (error) {
    logger.error({ err: error, check: name }, "health check failed");
    return { status: "down", reason: reasonOf(error) };
  } finally {
    clearTimeout(timer);
  }
}

type Health = { body: Record<string, unknown>; status: number };

// The landing page footer calls this on every visit. Each instance reuses one result for a
// few seconds, so traffic to the landing page can't turn into a query per visitor.
const REUSE_MS = 10_000;
let recent: { at: number; health: Promise<Health> } | null = null;

export async function GET() {
  await connection();
  const now = Date.now();
  if (!recent || now - recent.at > REUSE_MS) recent = { at: now, health: probe() };
  const { body, status } = await recent.health;
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function probe(): Promise<Health> {
  const [database, cache] = await Promise.all([
    check("db", () => db.$queryRaw`SELECT 1`),
    check("redis", () => redis.ping()),
  ]);
  // ioredis reports "max retries"; the connection error behind it is the useful part.
  if (cache.status === "down") cache.reason = lastRedisError() ?? cache.reason;

  const healthy = database.status === "ok" && cache.status === "ok";

  return {
    body: {
      status: healthy ? "ok" : "degraded",
      db: database.status,
      redis: cache.status,
      // Configuration only: probing Nexconn itself on every health check would spend API calls.
      // A team without it still works from Postgres, so it doesn't make the app degraded.
      nexconn: env.NEXCONN_APP_KEY && env.NEXCONN_APP_SECRET ? "configured" : "missing",
      ...(database.reason ? { dbReason: database.reason } : {}),
      ...(cache.reason ? { redisReason: cache.reason } : {}),
    },
    status: healthy ? 200 : 503,
  };
}
