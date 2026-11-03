import "server-only";
import { sweepCalls } from "@/features/call/server/permits";
import { expireParkedGates } from "@/features/gates/server/gates";
import { PARKED_TTL_MS } from "@/features/gates/shared/quorum";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const SWEEP_EVERY_SECONDS = 60;

// Housekeeping without a cron job (Vercel's free plan only runs cron daily): the next request
// after a quiet minute expires parked gates nobody decided in 24 h and closes calls whose
// browsers vanished. A Redis lock makes it run once per minute across all instances.
export async function maybeSweep(now: Date = new Date()): Promise<void> {
  try {
    const due = await redis.set("sweep:lock", "1", "EX", SWEEP_EVERY_SECONDS, "NX");
    if (due !== "OK") return;
    const expired = await expireParkedGates(db, new Date(now.getTime() - PARKED_TTL_MS));
    const calls = await sweepCalls(db, now);
    if (expired || calls.failed || calls.ended) {
      logger.info({ expired, ...calls }, "sweep");
    }
  } catch (error) {
    logger.warn({ err: error }, "sweep failed");
  }
}
