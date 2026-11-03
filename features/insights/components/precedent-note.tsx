import { History } from "lucide-react";
import type { Precedent } from "@/features/insights/shared/types";
import { timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function times(count: number): string {
  return count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
}

export function tallyLine(tally: Precedent["tally"]): string | null {
  const total = tally.approved + tally.denied;
  if (total < 2) return null;
  const parts = [
    tally.approved > 0 ? `approved ${times(tally.approved)}` : null,
    tally.denied > 0 ? `denied ${times(tally.denied)}` : null,
  ].filter(Boolean);
  return `This exact command in this repo: ${parts.join(", ")}.`;
}

// The team's earlier decision on the same (or a similar) command, shown before anyone votes.
export function PrecedentNote({ precedent }: { precedent: Precedent }) {
  const denied = precedent.status === "denied";
  const by = joinNames(precedent.by);
  const tally = tallyLine(precedent.tally);
  return (
    <div
      className={cn(
        "rounded-lg border-s-4 bg-muted/50 px-3 py-2 text-sm",
        denied ? "border-gate-denied" : "border-gate-approved",
      )}
      role="note"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <History className="size-3.5" aria-hidden />
        {precedent.match === "same"
          ? "Your team has decided this command before"
          : "Your team decided a similar command before"}
      </p>
      <p className="mt-0.5">
        <span className="font-semibold">TG-{precedent.code}</span>
        {precedent.sameRepo ? "" : ` in ${precedent.repo}`} was{" "}
        <span className={denied ? "text-gate-denied-fg" : "text-gate-approved-fg"}>
          {denied ? "denied" : "approved"}
        </span>
        {by ? ` by ${by}` : ""} {timeAgo(precedent.decidedAt)}
        {precedent.reason ? (
          <>
            : <span className="italic">&ldquo;{precedent.reason}&rdquo;</span>
          </>
        ) : (
          "."
        )}
      </p>
      {tally && <p className="mt-0.5 text-xs text-muted-foreground">{tally}</p>}
    </div>
  );
}
