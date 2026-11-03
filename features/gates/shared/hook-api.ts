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
    // Claude Code's own one-line description of the Bash call ("Apply pending migrations").
    intent: z.string().max(300).nullable().optional(),
    // What a wrapper or package script really runs ("pnpm db:deploy" -> "prisma migrate deploy"),
    // redacted by the hook. The server matches it again; it can only raise a gate, never lower it.
    via: z
      .array(
        z.object({ from: z.string().min(1).max(300), runs: z.string().min(1).max(1000) }).strict(),
      )
      .max(5)
      .optional(),
    redactions: z.number().int().min(0).max(10_000).default(0),
    cmdHash: z.string().regex(SHA256_RE),
    sessionId: z.string().max(200).optional(),
    // How long this hook waits before parking the gate (CLI 0.2.3+), for the countdown.
    waitSec: z.number().int().min(5).max(600).optional(),
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
  // Set when an approver asked a question instead of deciding (server 0.2+).
  question?: string | null;
  decidedBy: string | null;
  mode: "guard" | "delegate";
  url: string;
};
