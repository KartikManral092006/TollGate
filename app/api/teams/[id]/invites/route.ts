import { connection } from "next/server";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { createInvite } from "@/features/teams/server/teams";
import { createInviteSchema } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// Owner only. The link is returned once; only its hash is stored.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/invites">) {
  await connection();
  const auth = await requireWriter(request, { name: "invite", rule: { window: 3600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, createInviteSchema);
  if (!body.ok) return body.response;

  const invite = await createInvite(db, {
    id: newAlnumId(),
    teamId: id,
    createdById: auth.user.id,
    ...body.data,
  });
  return json(
    {
      url: new URL(`/invite/${invite.token}`, env.NEXT_PUBLIC_APP_URL).toString(),
      expiresAt: invite.expiresAt.toISOString(),
      role: body.data.role,
    },
    201,
  );
}
