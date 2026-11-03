import { connection } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

type CheckStatus = "ok" | "down";
type CheckResult = { status: CheckStatus; reason?: string };

// Generous: on a cold serverless start Neon wakes from scale-to-zero and Redis needs a fresh
// TLS connection.
const TIMEOUT_MS = 5000;

class HealthTimeout extends Error {}

// A short, non-secret code (timeout, ENOTFOUND, P1001, …) so a failed deploy can be
// diagnosed from the public endpoint without exposing hosts or credentials.
function reasonOf(error: unknown): string {
  if (error instanceof HealthTimeout) return "timeout";
  const code =
    (error as { code?: unknown; errorCode?: unknown } | null)?.code ??
    (error as { errorCode?: unknown } | null)?.errorCode;
  if (typeof code === "string" && /^[A-Za-z0-9_]{1,32}$/.test(code)) return code;
  const name = error instanceof Error ? error.name : "";
  return /^[A-Za-z]{1,40}$/.test(name) ? name : "error";
}

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

  const healthy = database.status === "ok" && cache.status === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      db: database.status,
      redis: cache.status,
      ...(database.reason ? { dbReason: database.reason } : {}),
      ...(cache.reason ? { redisReason: cache.reason } : {}),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
