import { connection, type NextRequest } from "next/server";
import { nexconnDisplayName } from "@/features/auth/shared/display-name";
import { NexconnNotConfiguredError } from "@/features/nexconn/server";
import { NexconnApiError } from "@/features/nexconn/server/client";
import { teamChatDeps } from "@/features/teams/server";
import { requireMember } from "@/features/teams/server/http";
import { ChatUnavailableError, ensureTeamChat } from "@/features/teams/server/team-chat";
import { json, rateLimited, requireUser } from "@/lib/http";
import { logger } from "@/lib/logger";
import { consumeRate } from "@/lib/rate-limit.server";
import { checkSameOriginJson } from "@/lib/request-guard";

// Puts the member into the team's Nexconn group (creating it if needed). Chat failures never
// break the room: it falls back to Postgres and reports 503 chat_unavailable.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/teams/[id]/chat">) {
  await connection();
  const guard = checkSameOriginJson(request);
  if (!guard.ok) return json({ error: guard.reason }, guard.status);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;

  // Every room visit lands here. A member already in the group costs one read and no Nexconn
  // call, so only the first join spends the rate limit; otherwise a few reloads would push
  // the room offline.
  const team = member.membership.team;
  if (member.membership.nexconnJoinedAt)
    return json({ chat: "ok", channelId: team.nexconnChannelId });
  const decision = await consumeRate(`nx:chat:${auth.user.id}`, { window: 600, max: 10 });
  if (!decision.allowed) return rateLimited(decision);

  const nexconnUserId = auth.user.nexconnUserId;
  if (!nexconnUserId) return json({ error: "nexconn_user_missing" }, 409);

  try {
    const result = await ensureTeamChat(teamChatDeps(), team, {
      id: auth.user.id,
      nexconnUserId,
      name: nexconnDisplayName({ name: auth.user.name, nexconnUserId }),
    });
    return json(result);
  } catch (error) {
    if (error instanceof NexconnNotConfiguredError) {
      return json({ error: "nexconn_not_configured" }, 503);
    }
    if (error instanceof ChatUnavailableError) {
      return json({ error: "chat_unavailable", reason: error.reason }, 503);
    }
    if (error instanceof NexconnApiError) {
      logger.warn(
        { path: error.path, httpStatus: error.httpStatus, code: error.code, teamId: id },
        "team chat setup failed",
      );
      return json({ error: "chat_unavailable" }, 503);
    }
    throw error;
  }
}
