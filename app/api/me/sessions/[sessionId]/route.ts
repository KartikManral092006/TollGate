import { connection } from "next/server";
import { getSessionFromHeaders } from "@/features/auth/server/session";
import { requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Signs out one of your other browsers. Your own current one signs out with Sign out.
export async function DELETE(request: Request, ctx: RouteContext<"/api/me/sessions/[sessionId]">) {
  await connection();
  const auth = await requireWriter(request, { name: "sessions", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { sessionId } = await ctx.params;
  if (!SESSION_ID_RE.test(sessionId)) return json({ error: "not_found" }, 404);
  const current = await getSessionFromHeaders(request.headers);
  if (!current) return json({ error: "unauthorized" }, 401);
  if (sessionId === current.sessionId) return json({ error: "current_session" }, 400);

  // Scoped to your user, so someone else's session id looks the same as a missing one.
  const { count } = await db.session.deleteMany({
    where: { id: sessionId, userId: current.user.id },
  });
  return count > 0 ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
