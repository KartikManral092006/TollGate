import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "@/features/auth/server/auth";
import { signInRedirectPath } from "@/features/auth/shared/routes";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  nexconnUserId: string | null;
  language: string;
};

function readSession(requestHeaders: Headers) {
  // Refresh is off here: a Server Component cannot write the refreshed cookie, so the DB
  // expiry would move without it. SessionRefresher refreshes through the route handler.
  return getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableRefresh: true },
  });
}

export async function getSessionUserFromHeaders(
  requestHeaders: Headers,
): Promise<SessionUser | null> {
  return toSessionUser(await readSession(requestHeaders));
}

// Same as above, plus the session row's id (to tell "this browser" from your others).
export async function getSessionFromHeaders(
  requestHeaders: Headers,
): Promise<{ user: SessionUser; sessionId: string } | null> {
  const session = await readSession(requestHeaders);
  const user = toSessionUser(session);
  return session && user ? { user, sessionId: session.session.id } : null;
}

function toSessionUser(session: Awaited<ReturnType<typeof readSession>>): SessionUser | null {
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    nexconnUserId: user.nexconnUserId ?? null,
    language: user.language,
  };
}

const getCurrentSession = cache(async () => getSessionFromHeaders(await headers()));

// Callers in pages must have awaited connection() first (Cache Components).
export const getOptionalSession = cache(
  async (): Promise<SessionUser | null> => (await getCurrentSession())?.user ?? null,
);

export const getCurrentSessionId = cache(
  async (): Promise<string | null> => (await getCurrentSession())?.sessionId ?? null,
);

// The real check behind every protected page; proxy.ts only looks for the cookie.
export const verifySession = cache(async (returnTo: string): Promise<SessionUser> => {
  const user = await getOptionalSession();
  if (!user) redirect(signInRedirectPath(returnTo));
  return user;
});
