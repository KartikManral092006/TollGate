import "server-only";
import type { SessionUser } from "@/features/auth/server/session";
import { getMembership } from "@/features/teams/server/teams";
import { ID_RE, type TeamRoleValue } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { json, rateLimited, requireUser } from "@/lib/http";
import { consumeRate } from "@/lib/rate-limit.server";
import type { RateRule } from "@/lib/rate-limit";
import { checkSameOriginJson, readJsonBody, TOO_LARGE } from "@/lib/request-guard";

type Fail = { ok: false; response: Response };

// Session + same-origin JSON + rate limit, for every browser write.
export async function requireWriter(
  request: Request,
  limit: { name: string; rule: RateRule },
): Promise<{ ok: true; user: SessionUser } | Fail> {
  const guard = checkSameOriginJson(request);
  if (!guard.ok) return { ok: false, response: json({ error: guard.reason }, guard.status) };
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const decision = await consumeRate(`${limit.name}:${auth.user.id}`, limit.rule);
  if (!decision.allowed) return { ok: false, response: rateLimited(decision) };
  return auth;
}

// Session + rate limit, for browser reads. The limits sit well above what open tabs poll
// (the room at most every 4 s), so they only stop runaway loops and scripted scraping.
export async function requireReader(
  request: Request,
  limit: { name: string; rule: RateRule },
): Promise<{ ok: true; user: SessionUser } | Fail> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const decision = await consumeRate(`read:${limit.name}:${auth.user.id}`, limit.rule);
  if (!decision.allowed) return { ok: false, response: rateLimited(decision) };
  return auth;
}

// Non-members get 404, not 403, so team IDs can't be probed.
export async function requireMember(
  teamId: string,
  userId: string,
  roles?: TeamRoleValue[],
): Promise<
  { ok: true; membership: NonNullable<Awaited<ReturnType<typeof getMembership>>> } | Fail
> {
  if (!ID_RE.test(teamId)) return { ok: false, response: json({ error: "not_found" }, 404) };
  const membership = await getMembership(db, teamId, userId);
  if (!membership) return { ok: false, response: json({ error: "not_found" }, 404) };
  if (roles && !roles.includes(membership.role)) {
    return { ok: false, response: json({ error: "forbidden" }, 403) };
  }
  return { ok: true, membership };
}

export async function readBody<T>(
  request: Request,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
): Promise<{ ok: true; data: T } | Fail> {
  const raw = await readJsonBody(request);
  if (raw === TOO_LARGE) return { ok: false, response: json({ error: "body_too_large" }, 413) };
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, response: json({ error: "invalid_body" }, 400) };
  return { ok: true, data: parsed.data };
}
