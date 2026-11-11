import { connection, type NextRequest } from "next/server";
import { unreadCount } from "@/features/activity/shared/activity";
import { loadActivity } from "@/features/activity/server/activity";
import { requireReader, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { redis } from "@/lib/redis";

const seenKey = (userId: string) => `activity:seen:${userId}`;

// Your feed and how much of it is new since you last opened it.
export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireReader(request, { name: "activity", rule: { window: 60, max: 60 } });
  if (!auth.ok) return auth.response;
  const [events, seen] = await Promise.all([
    loadActivity(db, auth.user.id),
    redis.get(seenKey(auth.user.id)).catch(() => null),
  ]);
  return json({ events, unread: unreadCount(events, Number(seen ?? 0)) });
}

// Opening the panel marks everything as read.
export async function POST(request: Request) {
  await connection();
  const auth = await requireWriter(request, { name: "activity", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  await redis
    .set(seenKey(auth.user.id), String(Date.now()), "EX", 60 * 60 * 24 * 30)
    .catch(() => null);
  return json({ ok: true });
}
