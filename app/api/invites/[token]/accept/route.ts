import { connection } from "next/server";
import { requireWriter } from "@/features/teams/server/http";
import { acceptInvite } from "@/features/teams/server/teams";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { isWellFormedSecret } from "@/lib/secret-token";

export async function POST(request: Request, ctx: RouteContext<"/api/invites/[token]/accept">) {
  await connection();
  const auth = await requireWriter(request, { name: "accept", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { token } = await ctx.params;
  if (!isWellFormedSecret(token, "inv")) return json({ error: "invalid" }, 404);

  const result = await acceptInvite(db, { token, userId: auth.user.id });
  if (!result.ok) return json({ error: result.reason }, result.reason === "invalid" ? 404 : 410);
  return json({ teamId: result.teamId, joinedNow: result.joinedNow });
}
