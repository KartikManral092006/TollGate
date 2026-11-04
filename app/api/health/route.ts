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

export async function GET() {
  await connection();

  const [database, cache] = await Promise.all([
    check("db", () => db.$queryRaw`SELECT 1`),
    check("redis", () => redis.ping()),
  ]);
  // ioredis reports "max retries"; the connection error behind it is the useful part.
  if (cache.status === "down") cache.reason = lastRedisError() ?? cache.reason;

  const healthy = database.status === "ok" && cache.status === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      db: database.status,
      redis: cache.status,
      // Configuration only: probing Nexconn itself on every health check would spend API calls.
      // A team without it still works from Postgres, so it doesn't make the app degraded.
      nexconn: env.NEXCONN_APP_KEY && env.NEXCONN_APP_SECRET ? "configured" : "missing",
      ...(database.reason ? { dbReason: database.reason } : {}),
      ...(cache.reason ? { redisReason: cache.reason } : {}),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
