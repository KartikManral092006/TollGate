import { connection } from "next/server";
import {
  readBody,
  requireMember,
  requireReader,
  requireWriter,
} from "@/features/teams/server/http";
import {
  AiConfigError,
  loadAiConfig,
  saveAiConfig,
  toAiConfigView,
} from "@/features/why/server/config";
import { aiConfigSchema } from "@/features/why/shared/providers";
import { db } from "@/lib/db";
import { json } from "@/lib/http";
import { redis } from "@/lib/redis";

const CONFIG_ERRORS: Record<AiConfigError["reason"], [number, string]> = {
  keys_not_configured: [503, "keys_not_configured"],
  key_required: [400, "key_required"],
  unsafe_url: [400, "unsafe_url"],
};

// Members can see which provider the team uses; never the key.
export async function GET(request: Request, ctx: RouteContext<"/api/teams/[id]/ai">) {
  await connection();
  const auth = await requireReader(request, { name: "ai", rule: { window: 60, max: 30 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id);
  if (!member.ok) return member.response;
  return json(toAiConfigView(await loadAiConfig(db, id)));
}

// Owner only. Changing the provider also clears cached explanations from the old one.
export async function PUT(request: Request, ctx: RouteContext<"/api/teams/[id]/ai">) {
  await connection();
  const auth = await requireWriter(request, { name: "aiconfig", rule: { window: 600, max: 20 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, aiConfigSchema);
  if (!body.ok) return body.response;

  try {
    const saved = await saveAiConfig(db, { teamId: id, userId: auth.user.id, config: body.data });
    await redis.incr(`why:gen:${id}`).catch(() => 0);
    return json(toAiConfigView(saved));
  } catch (error) {
    if (error instanceof AiConfigError) {
      const [status, code] = CONFIG_ERRORS[error.reason];
      return json({ error: code }, status);
    }
    throw error;
  }
}
