import { connection } from "next/server";
import { mintHookToken } from "@/features/gates/server/hook-tokens";
import { requireMember, requireWriter } from "@/features/teams/server/http";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

// A new hook token for a repo the team already linked: for a second laptop, or when the first
// command was lost. Same roles and limit as linking; the repo's name and mode stay as they are.
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/teams/[id]/repos/[repoId]/tokens">,
) {
  await connection();
  const auth = await requireWriter(request, { name: "repo", rule: { window: 3600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id, repoId } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner", "approver", "requester"]);
  if (!member.ok) return member.response;
  if (!ID_RE.test(repoId)) return json({ error: "not_found" }, 404);
  const repo = await db.repoLink.findFirst({
    where: { id: repoId, teamId: id },
    select: { id: true, name: true },
  });
  if (!repo) return json({ error: "not_found" }, 404);

  const minted = await mintHookToken(db, {
    id: newAlnumId(),
    repoId: repo.id,
    createdById: auth.user.id,
  });
  return json(
    {
      repo: repo.name,
      token: minted.token,
      prefix: minted.prefix,
      serverUrl: env.NEXT_PUBLIC_APP_URL,
    },
    201,
  );
}
