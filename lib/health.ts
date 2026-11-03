export class HealthTimeout extends Error {}

// A short, non-secret code (timeout, ENOTFOUND, P1001, …) so a failed deploy can be
// diagnosed from the public endpoint without exposing hosts or credentials.
export function reasonOf(error: unknown): string {
  if (error instanceof HealthTimeout) return "timeout";
  const code =
    (error as { code?: unknown; errorCode?: unknown } | null)?.code ??
    (error as { errorCode?: unknown } | null)?.errorCode;
  if (typeof code === "string" && /^[A-Za-z0-9_]{1,32}$/.test(code)) return code;
  // Redis replies start with an upper-case code (WRONGPASS, NOAUTH, ERR, …); they never
  // contain the host or password, so the first few words are safe to show.
  const message = error instanceof Error ? error.message : "";
  const reply = /^([A-Z]{2,}(?: [a-z][a-z' -]{0,60})?)/.exec(message)?.[1];
  if (reply) return reply.trim().replace(/\s+/g, "_").slice(0, 64);
  if (/max retries per request/i.test(message)) return "unreachable";
  if (/connection is closed/i.test(message)) return "connection_closed";
  const name = error instanceof Error ? error.name : "";
  // Production bundles shorten class names (MaxRetriesPerRequestError becomes "r").
  return /^[A-Za-z]{6,40}$/.test(name) ? name : "error";
}
