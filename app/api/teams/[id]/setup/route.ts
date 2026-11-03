import { connection } from "next/server";
import { loadSetupState } from "@/features/onboarding/server/setup";
import { requireMember } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json, requireUser } from "@/lib/http";

// Polled by the setup guide while steps are open, so each one ticks off on its own.
export async function GET(request: Request, ctx: RouteContext<"/api/teams/[id]/setup">) {
  await connection();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  return json(await loadSetupState(db, id, auth.user.id));
}
