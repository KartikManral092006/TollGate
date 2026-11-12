import { after, connection } from "next/server";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { displayName } from "@/features/gates/shared/view";
import { getNexconn } from "@/features/nexconn/server";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { explainGate } from "@/features/why/server/explain-gate";
import { streamWhyToRoom } from "@/features/why/server/share";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

// A gate's explanation is shared at most once in this window, however many people press it.
const SHARE_WINDOW_SECONDS = 600;

// Shares a gate's "Why?" with the whole room: explained once, then streamed into the team's
// Nexconn group by the Tollgate bot after the response, a sentence at a time.
export async function POST(request: Request, ctx: RouteContext<"/api/gates/[id]/why/share">) {
  await connection();
  const auth = await requireWriter(request, {
    name: "why-share",
    rule: { window: 600, max: 10 },
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!GATE_ID_RE.test(id)) return json({ error: "not_found" }, 404);

  const gate = await db.gate.findUnique({
    where: { id },
    include: {
      repo: { select: { name: true } },
      team: { select: { nexconnChannelId: true, nexconnGroupReadyAt: true } },
    },
  });
  if (!gate) return json({ error: "not_found" }, 404);
  const member = await requireMember(gate.teamId, auth.user.id);
  if (!member.ok) return member.response;
  if (!gate.team.nexconnGroupReadyAt) return json({ error: "chat_unavailable" }, 409);

  const fresh = await redis
    .set(`why:shared:${gate.id}`, "1", "EX", SHARE_WINDOW_SECONDS, "NX")
    .catch(() => "OK");
  if (fresh !== "OK") return json({ error: "already_shared" }, 409);

  const why = await explainGate(db, gate);
  const sharedBy = displayName(auth.user.name, auth.user.id);
  after(async () => {
    try {
      await streamWhyToRoom(
        { client: getNexconn(), sleep: (ms) => new Promise((done) => setTimeout(done, ms)) },
        {
          channelId: gate.team.nexconnChannelId,
          gateId: gate.id,
          code: gate.code,
          sharedBy,
          text: why.text,
        },
      );
    } catch (error) {
      logger.warn({ err: error, gateId: gate.id }, "couldn't stream the explanation to the room");
      await redis.del(`why:shared:${gate.id}`).catch(() => 0);
    }
  });
  return json({ ok: true, source: why.source });
}
