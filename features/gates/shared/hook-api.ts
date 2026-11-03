import { createHash } from "node:crypto";
import { z } from "zod";

// The contract between the CLI hook and /api/hook/*. Shared so both sides parse the same way.

export const GATE_ID_RE = /^[A-Za-z0-9]{32}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

// Binds a grant to one exact command in one place. Computed by the hook on the raw command
// (before redaction), so a grant can't be replayed for a different command, dir or repo.
export function commandHash(input: { repo: string; cwd: string; command: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([input.repo, input.cwd, input.command]), "utf8")
    .digest("hex");
}

export const createGateSchema = z
  .object({
    preset: z.string().min(1).max(40),
    quorum: z.number().int().min(1).max(9).optional(),
    env: z.enum(["prod", "staging", "other"]).optional(),
    command: z.string().min(1).max(4000), // redacted by the hook
    cwd: z.string().min(1).max(500), // redacted by the hook
    branch: z.string().max(200).nullable().optional(),
    context: z.string().max(2048).default(""),
    redactions: z.number().int().min(0).max(10_000).default(0),
    cmdHash: z.string().regex(SHA256_RE),
    sessionId: z.string().max(200).optional(),
  })
  .strict();

export type CreateGateInput = z.infer<typeof createGateSchema>;

export const consumeGrantSchema = z.object({ cmdHash: z.string().regex(SHA256_RE) }).strict();

export type HookGateStatus = {
  id: string;
  code: number;
  status: "pending" | "approved" | "denied" | "parked" | "expired";
  quorum: number;
  approvals: number;
  denyReason: string | null;
  decidedBy: string | null;
  mode: "guard" | "delegate";
  url: string;
};
