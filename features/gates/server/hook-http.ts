import "server-only";
import { authenticateHookToken, type HookPrincipal } from "@/features/gates/server/hook-tokens";
import { db } from "@/lib/db";
import { json, rateLimited } from "@/lib/http";
import { consumeRate } from "@/lib/rate-limit.server";
import type { RateRule } from "@/lib/rate-limit";

// Hook routes are called by the CLI, not a browser: no cookies, no same-origin check, only
// the repo's Bearer token. A token can create and read its own repo's gates, never vote.
export async function requireHook(
  request: Request,
  limit: { name: string; rule: RateRule },
): Promise<{ ok: true; principal: HookPrincipal } | { ok: false; response: Response }> {
  const principal = await authenticateHookToken(db, request.headers.get("authorization"));
  if (!principal) return { ok: false, response: json({ error: "unauthorized" }, 401) };
  const decision = await consumeRate(`hook:${limit.name}:${principal.tokenId}`, limit.rule);
  if (!decision.allowed) return { ok: false, response: rateLimited(decision) };
  return { ok: true, principal };
}

export function requireJsonContent(request: Request): Response | null {
  const type = request.headers.get("content-type") ?? "";
  return type.toLowerCase().startsWith("application/json")
    ? null
    : json({ error: "json_required" }, 415);
}
