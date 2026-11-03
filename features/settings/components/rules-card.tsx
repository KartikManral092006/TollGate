"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
// The rules list. The page's Settings section supplies the title and explanation.
export function RulesSettings({
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
    <div className="flex flex-col gap-6">
      {state.suggestions.length === 0 && state.rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No suggestions yet. They appear once a kind of command has a steady record.
        </p>
      )}

      {state.suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Suggested</h3>
          <ul className="divide-y border-y">
            {state.suggestions.map((s) => {
              const id = `${s.repoId}:${s.key}`;
              return (
                <li key={id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{suggestionTitle(s)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{suggestionEvidence(s)}</p>
                  </div>
                  {isOwner ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismiss(s)}
                        disabled={busy !== null}
                      >
                        Not now
                      </Button>
                      <Button size="sm" onClick={() => accept(s)} disabled={busy !== null}>
                        {busy === id && <Loader2 className="animate-spin" />}
                        Add rule
                      </Button>
                    </div>
                  ) : (
                    <p className="shrink-0 text-xs text-muted-foreground">
                      Only the owner can add rules.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state.rules.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Active</h3>
          <ul className="divide-y border-y">
            {state.rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 py-3 text-sm">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-gate-approved" />
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
        </div>
      )}
    </div>
  );
}
