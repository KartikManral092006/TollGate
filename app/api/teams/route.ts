import { connection } from "next/server";
import { readBody, requireWriter } from "@/features/teams/server/http";
import { createTeam } from "@/features/teams/server/teams";
import { createTeamSchema } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { newAlnumId } from "@/lib/ids";

export async function POST(request: Request) {
  await connection();
  const auth = await requireWriter(request, { name: "team", rule: { window: 86_400, max: 10 } });
  if (!auth.ok) return auth.response;
  const body = await readBody(request, createTeamSchema);
  if (!body.ok) return body.response;

  const team = await createTeam(db, {
    id: newAlnumId(),
    name: body.data.name,
    ownerId: auth.user.id,
  });
  return json({ id: team.id, name: team.name }, 201);
}
