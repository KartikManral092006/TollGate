import { connection } from "next/server";
import { requireHook } from "@/features/gates/server/hook-http";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

// Lets `tollgate init` and `status` confirm a token before writing any files.
export async function GET(request: Request) {
  await connection();
  const auth = await requireHook(request, { name: "whoami", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { principal } = auth;
  const [team, user] = await Promise.all([
    db.team.findUnique({ where: { id: principal.teamId }, select: { id: true, name: true } }),
    db.user.findUnique({ where: { id: principal.requesterId }, select: { name: true } }),
  ]);
  if (!team) return json({ error: "not_found" }, 404);
  return json({
    team,
    repo: { id: principal.repoId, name: principal.repoName, mode: principal.mode },
    user: { name: user?.name ?? "" },
  });
}
