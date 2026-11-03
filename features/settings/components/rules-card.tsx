"use client";

import { ListChecks, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SignIcon } from "@/components/road/sign-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PolicyState, RuleView } from "@/features/insights/server/policy";
import type { PolicySuggestion } from "@/features/insights/shared/policy";
import { timeAgo } from "@/features/room/shared/format";

function seconds(value: number | null): string {
  if (value === null) return "unknown";
  if (value < 60) return `${Math.round(value)} s`;
  return `${Math.round(value / 60)} min`;
}

export function suggestionTitle(s: Pick<PolicySuggestion, "action" | "preset" | "env" | "repo">) {
  return s.action === "one_approval"
    ? `Ask for one approval, not two, on ${s.preset} (${s.env}) in ${s.repo}`
    : `Approve ${s.preset} (${s.env}) in ${s.repo} automatically`;
}

export function suggestionEvidence(
  s: Pick<PolicySuggestion, "action" | "decided" | "medianSec" | "fastShare">,
) {
  const base = `Your team approved all ${s.decided} in the last 30 days and denied none. Median wait: ${seconds(s.medianSec)}.`;
  const fast = Math.round(s.fastShare * 100);
  return s.action === "auto_approve" && fast > 0
    ? `${base} ${fast}% were approved within 3 seconds, too fast to have been read.`
    : base;
}

function ruleLine(rule: RuleView): string {
  const what = rule.action === "auto_approve" ? "approved automatically" : "needs one approval";
  return `${rule.preset} (${rule.env}) in ${rule.repo}: ${what}`;
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return response.ok;
}

// Rules learned from the team's own decisions. Tollgate suggests; only the owner can accept,
// production never qualifies, and every gate a rule touches still shows up in the room.
export function RulesCard({
  teamId,
  isOwner,
  state,
}: {
  teamId: string;
  isOwner: boolean;
  state: PolicyState;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, work: () => Promise<boolean>, done: string, failed: string) {
    setBusy(id);
    try {
      if (await work()) {
        toast.success(done);
        router.refresh();
      } else {
        toast.error(failed);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const accept = (s: PolicySuggestion) =>
    act(
      `${s.repoId}:${s.key}`,
      () => send(`/api/teams/${teamId}/rules`, "POST", { repoId: s.repoId, key: s.key }),
      "Rule added. It applies to the next matching gate.",
      "This suggestion no longer fits your team's history.",
    );
  const dismiss = (s: PolicySuggestion) =>
    act(
      `${s.repoId}:${s.key}:no`,
      () =>
        send(`/api/teams/${teamId}/rules`, "POST", {
          repoId: s.repoId,
          key: s.key,
          dismiss: true,
        }),
      "Suggestion dismissed.",
      "Couldn't dismiss it.",
    );
  const remove = (rule: RuleView) =>
    act(
      rule.id,
      () => send(`/api/teams/${teamId}/rules/${rule.id}`, "DELETE"),
      "Rule removed. Matching gates wait for people again.",
      "Couldn't remove the rule.",
    );

  return (
    <Card id="rules" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <ListChecks />
          </SignIcon>
          Rules from your decisions
        </CardTitle>
        <CardDescription>
          When your team approves the same kind of command every time, waiting adds little. Tollgate
          suggests a rule after 10 approvals in 30 days with no denials. Never for production,
          publishing, infrastructure or deletes outside the repo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.suggestions.length === 0 && state.rules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No suggestions yet. They appear once a kind of command has a steady record.
          </p>
        )}

        {state.suggestions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {state.suggestions.map((s) => {
              const id = `${s.repoId}:${s.key}`;
              return (
                <li key={id} className="flex flex-col gap-2 rounded-xl border p-3">
                  <p className="text-sm font-semibold">{suggestionTitle(s)}</p>
                  <p className="text-sm text-muted-foreground">{suggestionEvidence(s)}</p>
                  {isOwner ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => accept(s)} disabled={busy !== null}>
                        {busy === id && <Loader2 className="animate-spin" />}
                        Add rule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismiss(s)}
                        disabled={busy !== null}
                      >
                        Not now
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Only the owner can add rules.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {state.rules.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Active rules</h3>
            <ul className="divide-y rounded-lg border">
              {state.rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ruleLine(rule)}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.by ? `Added by ${rule.by} ` : "Added "}
                      {timeAgo(rule.createdAt)}, applied to {rule.gates}{" "}
                      {rule.gates === 1 ? "gate" : "gates"}
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(rule)}
                      disabled={busy !== null}
                    >
                      {busy === rule.id && <Loader2 className="animate-spin" />}
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
