import { connection } from "next/server";
import { z } from "zod";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

const sharingSchema = z.object({ shareAgentTask: z.boolean() }).strict();

// Owner only: whether gates carry the developer's last instruction to the agent and its last
// few calls (sent from the developer's machine, redacted there and again here).
export async function PUT(request: Request, ctx: RouteContext<"/api/teams/[id]/sharing">) {
  await connection();
  const auth = await requireWriter(request, { name: "sharing", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, sharingSchema);
  if (!body.ok) return body.response;

  await db.team.update({ where: { id }, data: { shareAgentTask: body.data.shareAgentTask } });
  logger.info({ teamId: id, by: auth.user.id, ...body.data }, "team sharing changed");
  return json({ shareAgentTask: body.data.shareAgentTask });
}
