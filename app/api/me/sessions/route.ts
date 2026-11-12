import { connection } from "next/server";
import { getSessionFromHeaders } from "@/features/auth/server/session";
import { requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Signs you out everywhere except this browser. Sessions live only in the database (no
// cookie cache), so a deleted row signs that browser out on its next request.
export async function DELETE(request: Request) {
  await connection();
  const auth = await requireWriter(request, { name: "sessions", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const current = await getSessionFromHeaders(request.headers);
  if (!current) return json({ error: "unauthorized" }, 401);

  const { count } = await db.session.deleteMany({
    where: { userId: current.user.id, id: { not: current.sessionId } },
  });
  return json({ ok: true, signedOut: count });
}
