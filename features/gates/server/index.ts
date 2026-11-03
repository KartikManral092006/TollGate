import "server-only";
import { after } from "next/server";
import type { CallPolicy } from "@/features/call/server/permits";
import {
  mirrorGateState,
  mirrorHuddleState,
  postGateCard,
  postHuddleCard,
  type CardDeps,
} from "@/features/gates/server/cards";
import { sendEmail } from "@/features/email/server/resend";
import { getNexconn, NexconnNotConfiguredError } from "@/features/nexconn/server";
import {
  notifyGateParked,
  notifyGateWaiting,
  notifyParkedDecision,
  type NotifyDeps,
} from "@/features/notify/server/notify";
import { teamChatDeps } from "@/features/teams/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRate } from "@/lib/rate-limit.server";
import { redis } from "@/lib/redis";

function cardDeps(): CardDeps {
  return { db, client: getNexconn(), teamChat: teamChatDeps() };
}

// Nexconn work runs after the response and never fails the request: Postgres already holds
// the truth, and the room rebuilds card state from /api/teams/:id/gates.
function inBackground(label: string, ids: Record<string, string>, work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch (error) {
      if (error instanceof NexconnNotConfiguredError) return;
      logger.warn({ err: error, ...ids }, `${label} failed`);
    }
  });
}

// One email per person per 5 minutes (a burst of gates is one email), inside the same daily
// budget as sign-in links: Resend's free plan sends 100 a day.
const EMAIL_GAP_SECONDS = 300;
const EMAILS_PER_DAY = { window: 86_400, max: 90 };

function notifyDeps(): NotifyDeps {
  let nexconn: NotifyDeps["nexconn"] = null;
  try {
    nexconn = getNexconn();
  } catch (error) {
    if (!(error instanceof NexconnNotConfiguredError)) throw error;
  }
  return {
    db,
    nexconn,
    gateUrl,
    email: async (to, notice, options) => {
      if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return false;
      const fresh = await redis
        .set(`notify:${options?.kind ?? "email"}:${to.userId}`, "1", "EX", EMAIL_GAP_SECONDS, "NX")
        .catch(() => null);
      if (fresh !== "OK") return false;
      if (!(await consumeRate("ml:daily", EMAILS_PER_DAY)).allowed) return false;
      await sendEmail({
        apiKey: env.EMAIL_API_KEY,
        from: `Tollgate <${env.EMAIL_FROM}>`,
        to: to.address,
        subject: notice.subject,
        html: notice.html,
        text: notice.text,
      });
      return true;
    },
  };
}

export function announceGate(gateId: string) {
  inBackground("gate card", { gateId }, () => postGateCard(cardDeps(), gateId));
  inBackground("gate notice", { gateId }, () => notifyGateWaiting(notifyDeps(), gateId));
}

// The agent stopped waiting and nobody had decided: nudge the voters who haven't voted.
export function announceParked(gateId: string) {
  inBackground("parked reminder", { gateId }, () => notifyGateParked(notifyDeps(), gateId));
}

// The sweep's follow-up for gates still parked an hour later. Already inside after(), so it
// awaits directly instead of scheduling more background work.
export async function sendLateReminders(gateIds: string[]): Promise<void> {
  for (const gateId of gateIds) {
    try {
      await notifyGateParked(notifyDeps(), gateId, true);
    } catch (error) {
      logger.warn({ err: error, gateId }, "late reminder failed");
    }
  }
}

export function announceParkedDecision(gateId: string) {
  inBackground("parked decision notice", { gateId }, () =>
    notifyParkedDecision(notifyDeps(), gateId),
  );
}

export function mirrorGate(gateId: string) {
  inBackground("gate metadata", { gateId }, async () => {
    const deps = cardDeps();
    // A vote can land before the card was posted (slow first send): post it first.
    await postGateCard(deps, gateId);
    await mirrorGateState(deps, gateId);
  });
}

export function announceHuddle(permitId: string) {
  inBackground("huddle card", { permitId }, () => postHuddleCard(cardDeps(), permitId));
}

export function mirrorHuddle(permitId: string) {
  inBackground("huddle metadata", { permitId }, () => mirrorHuddleState(cardDeps(), permitId));
}

export function callPolicy(): CallPolicy {
  return {
    enabled: env.CALLS_ENABLED === "1",
    minutesPerDay: env.CALL_MINUTES_PER_TEAM_DAY,
  };
}

export function gateUrl(teamId: string, gateId: string): string {
  return new URL(`/teams/${teamId}?gate=${gateId}`, env.NEXT_PUBLIC_APP_URL).toString();
}
