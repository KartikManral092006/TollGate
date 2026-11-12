import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { ReportOutcomeInput } from "@/features/gates/shared/hook-api";
import { OUTPUT_TAIL_MAX } from "@/features/gates/shared/outcomes";
import { GRANT_TTL_MS } from "@/features/gates/shared/quorum";
import { redact, truncate } from "@/features/gates/shared/redact";

// An approved call runs right after its approval, or within a grant's lifetime when it was
// parked first: older approvals aren't this run.
export const OUTCOME_WINDOW_MS = GRANT_TTL_MS + 60 * 60 * 1000;

// Records what happened when an approved call ran, on the newest approved gate for this exact
// call (repo + cwd + command, the cmdHash) that has no outcome yet. Each gate takes one
// outcome: a later run of the same command is a new gate's business. Returns the gate's id, or
// null when there's nothing to attach it to (Claude Code's own permission prompt said no, the
// command was never gated, or the report arrived twice).
export async function recordOutcome(
  db: PrismaClient,
  input: { repoId: string; report: ReportOutcomeInput; now?: Date },
): Promise<string | null> {
  const now = input.now ?? new Date();
  const gate = await db.gate.findFirst({
    where: {
      repoId: input.repoId,
      cmdHash: input.report.cmdHash,
      // A bypass ran too; its outcome matters even more.
      status: { in: ["approved", "bypassed"] },
      outcomeAt: null,
      decidedAt: { gte: new Date(now.getTime() - OUTCOME_WINDOW_MS) },
    },
    orderBy: { decidedAt: "desc" },
    select: { id: true },
  });
  if (!gate) return null;

  const output = input.report.output?.trim()
    ? truncate(redact(input.report.output.trim()).text, OUTPUT_TAIL_MAX)
    : null;
  const { count } = await db.gate.updateMany({
    where: { id: gate.id, outcomeAt: null },
    data: {
      outcome: input.report.outcome,
      outcomeAt: now,
      exitCode: input.report.exitCode ?? null,
      durationMs: input.report.durationMs ?? null,
      output,
    },
  });
  return count === 1 ? gate.id : null;
}
