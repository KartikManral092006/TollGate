import { PhoneCall, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinNames } from "@/features/insights/components/precedent-note";
import type { SuggestedApprover } from "@/features/insights/shared/types";

export function approverLine(
  approvers: SuggestedApprover[],
  context: { viewerId: string; preset: string; repo: string },
): string | null {
  const first = approvers[0];
  if (!first) return null;
  const names = approvers.map((a) => (a.userId === context.viewerId ? "you" : a.name));
  const who = joinNames(names);
  const subject = who.charAt(0).toUpperCase() + who.slice(1);
  const scope =
    first.scope === "preset"
      ? `${context.preset} gates in ${context.repo}`
      : `gates in ${context.repo}`;
  const counts = approvers.map((a) => `${a.decided}`).join(" and ");
  return `${subject} usually ${approvers.length === 1 && names[0] !== "you" ? "decides" : "decide"} ${scope}: ${counts} of the last ${first.of}.`;
}

// Who to nudge: the people who usually decide this kind of gate, with a shortcut to ring them
// when calls are on.
export function SuggestedApprovers({
  approvers,
  viewerId,
  preset,
  repo,
  onRing,
}: {
  approvers: SuggestedApprover[];
  viewerId: string;
  preset: string;
  repo: string;
  onRing?: (userId: string) => void;
}) {
  const line = approverLine(approvers, { viewerId, preset, repo });
  if (!line) return null;
  const ringable = onRing ? approvers.filter((a) => a.userId !== viewerId) : [];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      <p className="flex min-w-0 flex-1 items-start gap-1.5">
        <UserRoundCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{line}</span>
      </p>
      {ringable.map((approver) => (
        <Button
          key={approver.userId}
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => onRing?.(approver.userId)}
        >
          <PhoneCall aria-hidden />
          Ring {approver.name.split(/\s+/)[0]}
        </Button>
      ))}
    </div>
  );
}
