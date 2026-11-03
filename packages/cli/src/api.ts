import type { HookGateStatus } from "../../../features/gates/shared/hook-api";
import type { HookApi, RepoConfig } from "./hook";

export const REQUEST_TIMEOUT_MS = 5000;

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
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${server}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      "User-Agent": "tollgate-cli",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  };
}

export type WhoAmI = {
  team: { id: string; name: string };
  repo: { id: string; name: string; mode: "guard" | "delegate" };
  user: { name: string };
};

export function whoAmI(server: string, token: string): Promise<WhoAmI> {
  return request<WhoAmI>(server.replace(/\/+$/, ""), token, "/api/hook/whoami");
}
