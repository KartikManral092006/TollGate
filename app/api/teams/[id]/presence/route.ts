import { connection } from "next/server";
import { freshPresence, presenceSchema } from "@/features/presence/shared/presence";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { json } from "@/lib/http";
import { redis } from "@/lib/redis";

// A heartbeat from an open room or gate page: records what this person is looking at or
// typing, and returns everyone who's here. Three Redis commands per call, every 15 s.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/presence">) {
  await connection();
  const auth = await requireWriter(request, { name: "presence", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  const body = await readBody(request, presenceSchema);
  if (!body.ok) return body.response;

  const key = `presence:${id}`;
  const now = Date.now();
  try {
    const [, , raw] = (await redis
      .multi()
      .hset(key, auth.user.id, JSON.stringify({ ...body.data, at: now }))
      .expire(key, 120)
      .hgetall(key)
      .exec()) as [unknown, unknown, [Error | null, Record<string, string>]];
    const { people, stale } = freshPresence(raw[1] ?? {}, now);
    if (stale.length > 0) await redis.hdel(key, ...stale).catch(() => undefined);
    return json({ people });
  } catch {
    // Presence is a nicety: without Redis the room still works.
    return json({ people: [] });
  }
}
