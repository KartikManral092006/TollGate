import type { HookGateStatus } from "../../../features/gates/shared/hook-api";
import type { HookApi, RepoConfig } from "./hook";

export const REQUEST_TIMEOUT_MS = 5000;
// init and status aren't on the hook's hot path, so they wait out a cold server and database.
export const SETUP_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function request<T>(
  server: string,
  token: string,
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const response = await fetch(`${server}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      "User-Agent": "tollgate-cli",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    let code = "error";
    try {
      code = ((await response.json()) as { error?: string }).error ?? code;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, code);
  }
  return (await response.json()) as T;
}

export function createApi(config: RepoConfig, token: string): HookApi {
  const call = <T>(path: string, init?: { method?: string; body?: unknown }) =>
    request<T>(config.server, token, path, init);
  return {
    consumeGrant: (cmdHash) =>
      call("/api/hook/grants/consume", { method: "POST", body: { cmdHash } }),
    createGate: (body) => call<HookGateStatus>("/api/hook/gates", { method: "POST", body }),
    getGate: (id) => call<HookGateStatus>(`/api/hook/gates/${id}`),
    park: (id) => call(`/api/hook/gates/${id}/park`, { method: "POST" }),
    reportOutcome: (body) => call("/api/hook/outcomes", { method: "POST", body }),
  };
}

export type WhoAmI = {
  team: { id: string; name: string };
  repo: { id: string; name: string; mode: "guard" | "delegate" };
  user: { name: string };
};

export function whoAmI(
  server: string,
  token: string,
  timeoutMs = SETUP_TIMEOUT_MS,
): Promise<WhoAmI> {
  return request<WhoAmI>(server.replace(/\/+$/, ""), token, "/api/hook/whoami", { timeoutMs });
}

// Plain-language reasons for a failed token check, instead of "fetch failed" or "401 unauthorized".
export function describeSetupError(
  error: unknown,
  server: string,
  timeoutMs = SETUP_TIMEOUT_MS,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "The server rejected this token. It may be revoked or mistyped: copy a fresh command from Settings › Repos.";
    }
    if (error.status === 429) return "Too many token checks. Wait a minute and try again.";
    if (error.status >= 500) return `${server} had an error (${error.status}). Try again shortly.`;
    return `${server} answered ${error.message}.`;
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return `${server} didn't answer within ${Math.round(timeoutMs / 1000)} s. Check the URL and your network, then try again.`;
  }
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
  if (cause?.code === "ENOTFOUND" || cause?.code === "EAI_AGAIN") {
    return `Couldn't find ${server}. Check the --server URL.`;
  }
  if (error instanceof TypeError) {
    return `Couldn't reach ${server}${cause?.code ? ` (${cause.code})` : ""}. Check the URL and your network.`;
  }
  return error instanceof Error ? error.message : String(error);
}
