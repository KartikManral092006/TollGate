import { createHash } from "node:crypto";
import { z } from "zod";
import { GATE_OUTCOMES, OUTPUT_TAIL_MAX } from "./outcomes";
import { GATE_TOOLS } from "./presets";

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

export const TASK_MAX = 500;
export const STEP_MAX = 160;
export const STEPS_MAX = 5;

export const createGateSchema = z
  .object({
    preset: z.string().min(1).max(40),
    // CLI 0.2.4+: what was stopped. Older hooks only send Bash commands.
    tool: z.enum(GATE_TOOLS).default("bash"),
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
    // The developer's last instruction to the agent and its last few calls, redacted by the
    // hook. Only sent when the server said the team shares them (CLI 0.3+).
    task: z.string().max(TASK_MAX).nullable().optional(),
    steps: z.array(z.string().min(1).max(STEP_MAX)).max(STEPS_MAX).optional(),
    redactions: z.number().int().min(0).max(10_000).default(0),
    cmdHash: z.string().regex(SHA256_RE),
    sessionId: z.string().max(200).optional(),
    // How long this hook waits before parking the gate (CLI 0.2.3+), for the countdown.
    waitSec: z.number().int().min(5).max(600).optional(),
  })
  .strict();

export type CreateGateInput = z.infer<typeof createGateSchema>;

export const consumeGrantSchema = z.object({ cmdHash: z.string().regex(SHA256_RE) }).strict();

// The grant check is the hook's first call for every gated command, so it also says whether
// the team wants the agent's task on the card (servers before 0.3 leave it out: false).
export type ConsumeGrantResponse =
  | { ok: true; gateId: string; mode: "guard" | "delegate"; shareTask?: boolean }
  | { ok: false; shareTask?: boolean };

export type HookGateStatus = {
  id: string;
  code: number;
  status: "pending" | "approved" | "denied" | "parked" | "expired" | "bypassed";
  quorum: number;
  approvals: number;
  denyReason: string | null;
  // Set when an approver asked a question instead of deciding (server 0.2+).
  question?: string | null;
  decidedBy: string | null;
  mode: "guard" | "delegate";
  url: string;
};

// What happened when an approved call ran (CLI 0.3+, from Claude Code's PostToolUse and
// PostToolUseFailure hooks). Bound to the gate by the same cmdHash the grant uses.
export const reportOutcomeSchema = z
  .object({
    cmdHash: z.string().regex(SHA256_RE),
    outcome: z.enum(GATE_OUTCOMES),
    exitCode: z.number().int().min(-1).max(255).nullable().optional(),
    durationMs: z
      .number()
      .int()
      .min(0)
      .max(7 * 86_400_000)
      .nullable()
      .optional(),
    output: z.string().max(OUTPUT_TAIL_MAX).nullable().optional(), // redacted by the hook
  })
  .strict();

export type ReportOutcomeInput = z.infer<typeof reportOutcomeSchema>;

// Someone started Claude Code with TOLLGATE_BYPASS=1 and a gated call went through without the
// team (CLI 0.3+). Queued on the laptop and sent after the call, so an emergency never waits
// on the network. `id` is made by the hook: sending the same report twice records it once.
export const reportBypassSchema = createGateSchema
  .omit({ quorum: true, waitSec: true, task: true, steps: true })
  .extend({
    id: z.string().regex(GATE_ID_RE),
    // When it happened (ms since epoch); a queued report can arrive later.
    at: z.number().int().positive(),
  })
  .strict();

export type ReportBypassInput = z.infer<typeof reportBypassSchema>;
