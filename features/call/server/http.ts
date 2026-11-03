import "server-only";
import { CallRejectedError } from "@/features/call/server/permits";
import { json } from "@/lib/http";

const STATUS_FOR: Record<CallRejectedError["reason"], number> = {
  calls_disabled: 503,
  not_found: 404,
  closed: 409,
  budget: 429,
  busy: 409,
  no_callees: 409,
  callee_not_allowed: 403,
};

export function callErrorResponse(error: unknown): Response {
  if (error instanceof CallRejectedError) {
    return json({ error: error.reason }, STATUS_FOR[error.reason]);
  }
  throw error;
}
