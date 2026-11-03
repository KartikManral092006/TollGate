import "server-only";
import type { TeamChatDeps } from "@/features/teams/server/team-chat";
import { getNexconn } from "@/features/nexconn/server";
import { getChatToken } from "@/features/nexconn/server/tokens";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { consumeRateStrict } from "@/lib/rate-limit.server";
import { redis } from "@/lib/redis";

const GROUP_CREATES_PER_DAY = { window: 86_400, max: 200 };
const GROUP_CREATES_PER_USER = { window: 86_400, max: 5 };
const GROUP_LOCK_SECONDS = 30;

export function teamChatDeps(): TeamChatDeps {
  return {
    db,
    client: getNexconn(),
    registerUser: getChatToken,
    allowGroupCreate: async (userId) =>
      (await consumeRateStrict(`nx:group:create:u:${userId}`, GROUP_CREATES_PER_USER)).allowed &&
      (await consumeRateStrict("nx:group:create", GROUP_CREATES_PER_DAY)).allowed,
    acquireGroupLock: async (teamId) => {
      try {
        const result = await redis.set(
          `nx:group:lock:${teamId}`,
          "1",
          "EX",
          GROUP_LOCK_SECONDS,
          "NX",
        );
        return result === "OK";
      } catch (error) {
        logger.warn({ err: error }, "group lock unavailable");
        return false;
      }
    },
    releaseGroupLock: async (teamId) => {
      await redis.del(`nx:group:lock:${teamId}`).catch(() => 0);
    },
  };
}
