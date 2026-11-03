import type { GateStatus, PrismaClient, VoteDecision } from "@/lib/generated/prisma/client";
import type { HookPrincipal } from "@/features/gates/server/hook-tokens";
import type { CreateGateInput } from "@/features/gates/shared/hook-api";
import {
  authoritativeQuorum,
  DEFAULT_PRESETS,
  detectEnv,
  matchPreset,
  presetListSchema,
  type Preset,
} from "@/features/gates/shared/presets";
import {
  evaluate,
  GRANT_TTL_MS,
  needsGrant,
  voteRejection,
  type Evaluation,
} from "@/features/gates/shared/quorum";
import { redact, truncate } from "@/features/gates/shared/redact";
import { applyRule } from "@/features/insights/shared/policy";
import { canVote, type TeamRoleValue } from "@/features/teams/shared/schemas";

// How long after a question the requester's next gate in the same repo counts as the answer.
export const FOLLOW_UP_WINDOW_MS = 30 * 60 * 1000;

// What the agent receives when an approver asks instead of deciding. The hook (0.2+) words its
// own message from `question`; older hooks only see this text.
export function questionReason(question: string): string {
  return `Question before deciding: "${question}" Answer it in the description of your next Bash call, then run the same command again.`;
}

export function repoPresets(raw: unknown): Preset[] {
  const parsed = presetListSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PRESETS;
}

type Ids = { newId: () => string; now?: () => Date };

// The hook already redacted; the server redacts again (never trust the client) and applies
// its own presets, so a local .tollgate.json can't lower the quorum.
export async function createGate(
  db: PrismaClient,
  principal: HookPrincipal,
  input: CreateGateInput,
  ids: Ids,
) {
  const command = redact(input.command);
  const cwd = redact(input.cwd);
  const context = redact(input.context);
  const intent = input.intent ? redact(input.intent) : null;
  const serverMatch = matchPreset(repoPresets(principal.presets), {
    command: command.text,
    cwd: cwd.text,
    // The server never sees the real repo root; only pattern matching applies here.
    repoRoot: cwd.text,
  });
  const presetQuorum = authoritativeQuorum(serverMatch, input.quorum);
  const env = serverMatch?.env === "prod" ? "prod" : (input.env ?? serverMatch?.env ?? "other");
  const preset = serverMatch?.preset.name ?? input.preset;
  const now = ids.now?.() ?? new Date();

  // A team rule only applies when the server's own presets recognised the command, so a local
  // .tollgate.json can't name its way into one.
  const rule = serverMatch
    ? await db.policyRule.findUnique({
        where: { repoId_preset_env: { repoId: principal.repoId, preset, env } },
        select: { id: true, action: true },
      })
    : null;
  const policy = applyRule(rule, {
    env,
    commandLooksProd: detectEnv(command.text) === "prod",
    quorum: presetQuorum,
  });
  const ruleApplied = rule && (policy.autoApprove || policy.quorum !== presetQuorum);

  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ code: number }[]>`
      UPDATE teams SET "nextGateCode" = "nextGateCode" + 1, "updatedAt" = now()
      WHERE id = ${principal.teamId}
      RETURNING "nextGateCode" - 1 AS code`;
    if (!row) throw new Error("Team not found for hook token");

    // The agent's next gate after a question is its answer: same requester and repo, soon after,
    // and only one answer per question.
    const asked = await tx.gate.findFirst({
      where: {
        repoId: principal.repoId,
        requesterId: principal.requesterId,
        status: "denied",
        question: { not: null },
        decidedAt: { gte: new Date(now.getTime() - FOLLOW_UP_WINDOW_MS) },
        followUps: { none: {} },
      },
      orderBy: { decidedAt: "desc" },
      select: { id: true },
    });

    return tx.gate.create({
      data: {
        id: ids.newId(),
        code: Number(row.code),
        teamId: principal.teamId,
        repoId: principal.repoId,
        requesterId: principal.requesterId,
        preset,
        env,
        command: truncate(command.text, 4000),
        cwd: truncate(cwd.text, 500),
        branch: input.branch ? truncate(redact(input.branch).text, 200) : null,
        context: truncate(context.text, 2048),
        intent: intent ? truncate(intent.text, 300) : null,
        redactions:
          input.redactions + command.count + cwd.count + context.count + (intent?.count ?? 0),
        cmdHash: input.cmdHash,
        quorum: policy.quorum,
        followUpOfId: asked?.id ?? null,
        policyRuleId: ruleApplied ? rule.id : null,
        ...(policy.autoApprove ? { status: "approved" as const, decidedAt: now } : {}),
      },
    });
  });
}

export async function getGateForRepo(db: PrismaClient, gateId: string, repoId: string) {
  const gate = await db.gate.findFirst({
    where: { id: gateId, repoId },
    include: {
      votes: { select: { userId: true, decision: true } },
      grant: { select: { expiresAt: true, usedAt: true } },
    },
  });
  if (!gate) return null;
  const decider = gate.decidedById
    ? await db.user.findUnique({ where: { id: gate.decidedById }, select: { name: true } })
    : null;
  return {
    gate,
    approvals: gate.votes.filter((vote) => vote.decision === "approve").length,
    decidedByName: decider?.name || null,
  };
}

// Only a pending gate can be parked; parking twice (a retried hook) is not an error.
// `parkedNow` is true only for the call that moved the gate to parked, so a retried hook
// doesn't send the reminder twice.
export async function parkGate(
  db: PrismaClient,
  input: { gateId: string; repoId: string; now?: Date },
): Promise<{ status: GateStatus; parkedNow: boolean } | null> {
  const { count } = await db.gate.updateMany({
    where: { id: input.gateId, repoId: input.repoId, status: "pending" },
    data: { status: "parked", parkedAt: input.now ?? new Date() },
  });
  const gate = await db.gate.findFirst({
    where: { id: input.gateId, repoId: input.repoId },
    select: { status: true },
  });
  return gate ? { status: gate.status, parkedNow: count === 1 } : null;
}

export class VoteRejectedError extends Error {
  override readonly name = "VoteRejectedError";

  constructor(
    readonly reason: "not_found" | "closed" | "own_gate" | "not_allowed" | "voted" | "not_waiting",
  ) {
    super(`Vote rejected: ${reason}`);
  }
}

export type VoteOutcome = {
  gateId: string;
  teamId: string;
  code: number;
  previous: GateStatus;
  evaluation: Evaluation;
  quorum: number;
  votes: { userId: string; decision: VoteDecision }[];
  grantExpiresAt: Date | null;
  messageId: string | null;
};

// One transaction with the gate row locked: concurrent votes are serialised, so quorum is
// reached (and a grant issued) exactly once.
export async function castVote(
  db: PrismaClient,
  input: {
    gateId: string;
    userId: string;
    decision: VoteDecision;
    reason?: string | null;
    // Ask instead of deciding: closes the gate like a deny, and the agent must answer.
    question?: string | null;
    newId: () => string;
    now?: Date;
  },
): Promise<VoteOutcome> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const [gate] = await tx.$queryRaw<
      {
        id: string;
        teamId: string;
        repoId: string;
        code: number;
        requesterId: string;
        status: GateStatus;
        quorum: number;
        cmdHash: string;
        messageId: string | null;
      }[]
    >`SELECT id, "teamId", "repoId", code, "requesterId", status, quorum, "cmdHash", "messageId"
      FROM gates WHERE id = ${input.gateId} FOR UPDATE`;
    if (!gate) throw new VoteRejectedError("not_found");

    const membership = await tx.membership.findUnique({
      where: { teamId_userId: { teamId: gate.teamId, userId: input.userId } },
      select: { role: true },
    });
    if (!membership) throw new VoteRejectedError("not_found");

    const rejection = voteRejection({
      status: gate.status,
      requesterId: gate.requesterId,
      voterId: input.userId,
      voterCanVote: canVote(membership.role as TeamRoleValue),
    });
    if (rejection) throw new VoteRejectedError(rejection);
    const question = input.question?.trim() || null;
    // Only a waiting hook passes the question on; a parked agent has stopped listening.
    if (question && gate.status !== "pending") throw new VoteRejectedError("not_waiting");

    const { count } = await tx.vote.createMany({
      data: [
        {
          gateId: gate.id,
          userId: input.userId,
          decision: question ? "deny" : input.decision,
          reason: question ?? (input.reason?.trim() || null),
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) throw new VoteRejectedError("voted");

    const votes = await tx.vote.findMany({
      where: { gateId: gate.id },
      orderBy: { createdAt: "asc" },
      select: { userId: true, decision: true, reason: true },
    });
    const evaluation = evaluate({
      status: gate.status,
      quorum: gate.quorum,
      requesterId: gate.requesterId,
      votes,
    });

    let grantExpiresAt: Date | null = null;
    if (evaluation.status === "approved" || evaluation.status === "denied") {
      const denial =
        evaluation.status === "denied"
          ? votes.find((vote) => vote.userId === evaluation.deniedBy)
          : undefined;
      await tx.gate.update({
        where: { id: gate.id },
        data: {
          status: evaluation.status,
          decidedAt: now,
          decidedById: evaluation.status === "denied" ? evaluation.deniedBy : input.userId,
          denyReason: denial
            ? question
              ? questionReason(question)
              : denial.reason || "Denied without a reason."
            : null,
          question: evaluation.status === "denied" ? question : null,
        },
      });
      if (needsGrant(gate.status, evaluation.status)) {
        grantExpiresAt = new Date(now.getTime() + GRANT_TTL_MS);
        await tx.grant.create({
          data: {
            id: input.newId(),
            gateId: gate.id,
            repoId: gate.repoId,
            cmdHash: gate.cmdHash,
            expiresAt: grantExpiresAt,
          },
        });
      }
    }

    return {
      gateId: gate.id,
      teamId: gate.teamId,
      code: gate.code,
      previous: gate.status,
      evaluation,
      quorum: gate.quorum,
      votes: votes.map(({ userId, decision }) => ({ userId, decision })),
      grantExpiresAt,
      messageId: gate.messageId,
    };
  });
}

// Single use: exactly one caller gets the row back, however many retries race.
export async function consumeGrant(
  db: PrismaClient,
  input: { repoId: string; cmdHash: string; now?: Date },
): Promise<{ gateId: string } | null> {
  const now = input.now ?? new Date();
  const rows = await db.$queryRaw<{ gateId: string }[]>`
    UPDATE grants SET "usedAt" = ${now}
    WHERE id = (
      SELECT id FROM grants
      WHERE "repoId" = ${input.repoId} AND "cmdHash" = ${input.cmdHash}
        AND "usedAt" IS NULL AND "expiresAt" > ${now}
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "gateId"`;
  return rows[0] ?? null;
}

// Parked gates nobody decided within the TTL. Run from a sweeper.
export async function expireParkedGates(db: PrismaClient, olderThan: Date): Promise<number> {
  const { count } = await db.gate.updateMany({
    where: { status: "parked", parkedAt: { lt: olderThan } },
    data: { status: "expired" },
  });
  return count;
}

// Claims gates parked between `notBefore` and `parkedBefore` that haven't had their follow-up
// reminder, marking them so each gate is reminded once even with concurrent sweeps.
export async function claimLateReminders(
  db: PrismaClient,
  window: { parkedBefore: Date; notBefore: Date },
  limit = 20,
): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE gates SET "remindedAt" = now()
    WHERE id IN (
      SELECT id FROM gates
      WHERE status = 'parked' AND "remindedAt" IS NULL
        AND "parkedAt" < ${window.parkedBefore} AND "parkedAt" > ${window.notBefore}
      ORDER BY "parkedAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((row) => row.id);
}

export function listTeamGates(
  db: PrismaClient,
  teamId: string,
  options: { take?: number; cursor?: string } = {},
) {
  return db.gate.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: Math.min(options.take ?? 50, 500),
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: {
      requester: { select: { id: true, name: true } },
      repo: { select: { name: true, mode: true } },
      votes: {
        orderBy: { createdAt: "asc" },
        select: {
          userId: true,
          decision: true,
          reason: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
      grant: { select: { expiresAt: true, usedAt: true } },
      followUpOf: {
        select: {
          code: true,
          question: true,
          votes: {
            where: { decision: "deny" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
      followUps: { select: { code: true }, orderBy: { createdAt: "asc" }, take: 1 },
      policyRule: {
        select: { action: true, preset: true, env: true, createdBy: { select: { name: true } } },
      },
      calls: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          callId: true,
          kind: true,
          status: true,
          durationSec: true,
          participants: true,
          startedById: true,
        },
      },
    },
  });
}
