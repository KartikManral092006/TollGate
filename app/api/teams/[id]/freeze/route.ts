import { connection } from "next/server";
import { z } from "zod";
import { endFreeze, FreezeError, startFreeze } from "@/features/teams/server/freeze";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import {
  FREEZE_KINDS,
  FREEZE_MINUTES,
  FREEZE_REASON_MAX,
  type FreezeMinutes,
} from "@/features/teams/shared/freeze";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

const startSchema = z
  .object({
    kind: z.enum(FREEZE_KINDS),
    reason: z.string().trim().max(FREEZE_REASON_MAX).optional(),
    minutes: z
      .number()
      .refine((minutes): minutes is FreezeMinutes =>
        (FREEZE_MINUTES as readonly number[]).includes(minutes),
      ),
  })
  .strict();

const STATUS_FOR: Record<FreezeError["reason"], [number, string]> = {
  not_member: [404, "not_found"],
  not_allowed: [403, "forbidden"],
};

function rejected(error: unknown) {
  if (!(error instanceof FreezeError)) throw error;
  const [status, code] = STATUS_FOR[error.reason];
  return json({ error: code }, status);
}

// Owners and approvers start (or change) a freeze or incident mode.
export async function PUT(request: Request, ctx: RouteContext<"/api/teams/[id]/freeze">) {
  await connection();
  const auth = await requireWriter(request, { name: "freeze", rule: { window: 600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  const body = await readBody(request, startSchema);
  if (!body.ok) return body.response;
  try {
    const freeze = await startFreeze(db, { teamId: id, userId: auth.user.id, ...body.data });
    logger.info(
      { teamId: id, by: auth.user.id, kind: freeze.kind, until: freeze.until },
      "freeze on",
    );
    return json({ freeze });
  } catch (error) {
    return rejected(error);
  }
}

// Owners and approvers end it early.
export async function DELETE(request: Request, ctx: RouteContext<"/api/teams/[id]/freeze">) {
  await connection();
  const auth = await requireWriter(request, { name: "freeze", rule: { window: 600, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  try {
    const ended = await endFreeze(db, { teamId: id, userId: auth.user.id });
    if (ended) logger.info({ teamId: id, by: auth.user.id }, "freeze off");
    return json({ freeze: null, ended });
  } catch (error) {
    return rejected(error);
  }
}
