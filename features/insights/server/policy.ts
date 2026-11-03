import type { PrismaClient } from "@/lib/generated/prisma/client";
import { displayName } from "@/features/gates/shared/view";
import {
  suggestPolicies,
  WINDOW_DAYS,
  type PolicyActionValue,
  type PolicyHistoryGate,
  type PolicySuggestion,
} from "@/features/insights/shared/policy";

export type RuleView = {
  id: string;
  repoId: string;
  repo: string;
  preset: string;
  env: string;
  action: PolicyActionValue;
  by: string | null;
  createdAt: string;
  gates: number; // gates the rule has changed
};

export type PolicyState = { suggestions: PolicySuggestion[]; rules: RuleView[] };

export async function loadPolicyState(db: PrismaClient, teamId: string): Promise<PolicyState> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [repos, gates] = await Promise.all([
    db.repoLink.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        dismissedSuggestions: true,
        rules: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            preset: true,
            env: true,
            action: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true } },
            _count: { select: { gates: true } },
          },
        },
      },
    }),
    // People's decisions only: questions and a rule's own approvals aren't evidence.
    db.gate.findMany({
      where: {
        teamId,
        status: { in: ["approved", "denied"] },
        question: null,
        createdAt: { gte: since },
        votes: { some: {} },
      },
      select: {
        repoId: true,
        preset: true,
        env: true,
        status: true,
        quorum: true,
        createdAt: true,
        decidedAt: true,
        repo: { select: { name: true } },
        votes: { where: { decision: "approve" }, select: { createdAt: true } },
      },
    }),
  ]);

  const history: PolicyHistoryGate[] = gates.map((g) => ({
    repoId: g.repoId,
    repo: g.repo.name,
    preset: g.preset,
    env: g.env,
    status: g.status as PolicyHistoryGate["status"],
    quorum: g.quorum,
    createdAt: g.createdAt.toISOString(),
    decidedAt: g.decidedAt?.toISOString() ?? null,
    approvalMs: g.votes.map((v) => v.createdAt.getTime() - g.createdAt.getTime()),
  }));
  const rules = repos.flatMap((repo) =>
    repo.rules.map((rule) => ({ ...rule, repoId: repo.id, repo: repo.name })),
  );
  const dismissed = Object.fromEntries(repos.map((r) => [r.id, r.dismissedSuggestions]));

  return {
    suggestions: suggestPolicies(history, rules, dismissed),
    rules: rules.map((rule) => ({
      id: rule.id,
      repoId: rule.repoId,
      repo: rule.repo,
      preset: rule.preset,
      env: rule.env,
      action: rule.action,
      by: rule.createdBy ? displayName(rule.createdBy.name, rule.createdBy.id) : null,
      createdAt: rule.createdAt.toISOString(),
      gates: rule._count.gates,
    })),
  };
}

// Only a rule Tollgate is currently suggesting can be created: the API can't be used to
// auto-approve something the team's history doesn't support (or anything in production).
export async function acceptSuggestion(
  db: PrismaClient,
  input: { teamId: string; repoId: string; key: string; userId: string; newId: () => string },
): Promise<RuleView["id"] | null> {
  const { suggestions } = await loadPolicyState(db, input.teamId);
  const suggestion = suggestions.find((s) => s.repoId === input.repoId && s.key === input.key);
  if (!suggestion) return null;
  const rule = await db.policyRule.upsert({
    where: {
      repoId_preset_env: {
        repoId: suggestion.repoId,
        preset: suggestion.preset,
        env: suggestion.env,
      },
    },
    create: {
      id: input.newId(),
      repoId: suggestion.repoId,
      preset: suggestion.preset,
      env: suggestion.env,
      action: suggestion.action,
      createdById: input.userId,
    },
    update: { action: suggestion.action, createdById: input.userId },
    select: { id: true },
  });
  return rule.id;
}

export async function dismissSuggestion(
  db: PrismaClient,
  input: { teamId: string; repoId: string; key: string },
): Promise<boolean> {
  const repo = await db.repoLink.findFirst({
    where: { id: input.repoId, teamId: input.teamId },
    select: { dismissedSuggestions: true },
  });
  if (!repo) return false;
  if (!repo.dismissedSuggestions.includes(input.key)) {
    await db.repoLink.update({
      where: { id: input.repoId },
      data: { dismissedSuggestions: { push: input.key } },
    });
  }
  return true;
}

export async function removeRule(
  db: PrismaClient,
  input: { teamId: string; ruleId: string },
): Promise<boolean> {
  const { count } = await db.policyRule.deleteMany({
    where: { id: input.ruleId, repo: { teamId: input.teamId } },
  });
  return count === 1;
}
