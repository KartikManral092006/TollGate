import { connection } from "next/server";
import { mintHookToken } from "@/features/gates/server/hook-tokens";
import { DEFAULT_PRESETS } from "@/features/gates/shared/presets";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { createRepoSchema } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// Links a repo (or reuses the link) and mints a hook token for the caller. The plaintext
// token is in this response only. Delegate mode can be set by the owner only.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/repos">) {
  await connection();
  const auth = await requireWriter(request, { name: "repo", rule: { window: 3600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner", "approver", "requester"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, createRepoSchema);
  if (!body.ok) return body.response;
  if (body.data.mode === "delegate" && member.membership.role !== "owner") {
    return json({ error: "forbidden" }, 403);
  }

  const repo = await db.repoLink.upsert({
    where: { teamId_name: { teamId: id, name: body.data.name } },
    create: {
      id: newAlnumId(),
      teamId: id,
      name: body.data.name,
      mode: body.data.mode,
      presets: DEFAULT_PRESETS,
    },
    update: member.membership.role === "owner" ? { mode: body.data.mode } : {},
  });
  const minted = await mintHookToken(db, {
    id: newAlnumId(),
    repoId: repo.id,
    createdById: auth.user.id,
  });
  return json(
    {
      repo: { id: repo.id, name: repo.name, mode: repo.mode },
      token: minted.token,
      prefix: minted.prefix,
      serverUrl: env.NEXT_PUBLIC_APP_URL,
      presets: repo.presets,
    },
    201,
  );
}
