import "server-only";
import { sweepCalls } from "@/features/call/server/permits";
import { sendLateReminders } from "@/features/gates/server";
import { claimLateReminders, expireParkedGates } from "@/features/gates/server/gates";
import { PARKED_TTL_MS } from "@/features/gates/shared/quorum";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const SWEEP_EVERY_SECONDS = 60;
// Every hook poll and room refresh calls maybeSweep. Asking Redis for the lock on each of
// them would add a command per request, so an instance asks at most this often.
const LOCAL_CHECK_EVERY_MS = 20_000;
let lastLocalCheck = 0;
const LATE_REMINDER_MS = 60 * 60 * 1000;
// Gates parked longer ago than this never get the follow-up (e.g. right after a deploy).
const LATE_REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000;

// Housekeeping without a cron job (Vercel's free plan only runs cron daily): the next request
// after a quiet minute sends the one-hour reminder for parked gates, expires those nobody
// decided in 24 h and closes calls whose
// browsers vanished. A Redis lock makes it run once per minute across all instances.
export async function maybeSweep(now: Date = new Date()): Promise<void> {
  if (now.getTime() - lastLocalCheck < LOCAL_CHECK_EVERY_MS) return;
  lastLocalCheck = now.getTime();
  try {
    const due = await redis.set("sweep:lock", "1", "EX", SWEEP_EVERY_SECONDS, "NX");
    if (due !== "OK") return;
    const expired = await expireParkedGates(db, new Date(now.getTime() - PARKED_TTL_MS));
    const reminders = await claimLateReminders(db, {
      parkedBefore: new Date(now.getTime() - LATE_REMINDER_MS),
      notBefore: new Date(now.getTime() - LATE_REMINDER_WINDOW_MS),
    });
    await sendLateReminders(reminders);
    const calls = await sweepCalls(db, now);
    if (expired || reminders.length || calls.failed || calls.ended) {
      logger.info({ expired, reminded: reminders.length, ...calls }, "sweep");
    }
  } catch (error) {
    logger.warn({ err: error }, "sweep failed");
  }
}
