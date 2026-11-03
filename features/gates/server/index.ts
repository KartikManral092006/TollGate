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
import { getNexconn, NexconnNotConfiguredError } from "@/features/nexconn/server";
import { teamChatDeps } from "@/features/teams/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

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

export function announceGate(gateId: string) {
  inBackground("gate card", { gateId }, () => postGateCard(cardDeps(), gateId));
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
