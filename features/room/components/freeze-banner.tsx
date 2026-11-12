"use client";

import { Loader2, Siren, Snowflake } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { timeAgo, untilTime } from "@/features/room/shared/format";
import { freezeLabel, type FreezeView } from "@/features/teams/shared/freeze";
import { cn } from "@/lib/utils";

export const FREEZE_RULES =
  "Nothing is approved automatically: team rules and approval windows are paused. Production needs two approvals, or one from an owner.";

export async function endFreezeRequest(teamId: string): Promise<boolean> {
  const response = await fetch(`/api/teams/${teamId}/freeze`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return response.ok;
}

// While the team is frozen: what that means, until when, and (for owners and approvers) a way
// to end it early. Shown above the room's thread and in Settings.
export function FreezeBanner({
  teamId,
  freeze,
  canEnd,
  onChange,
  className,
}: {
  teamId: string;
  freeze: FreezeView | null;
  canEnd: boolean;
  onChange: (next: FreezeView | null) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function end() {
    setBusy(true);
    try {
      if (await endFreezeRequest(teamId)) {
        onChange(null);
        toast.success(
          `${freezeLabel(freeze!.kind)} ended. Rules and approval windows apply again.`,
        );
      } else {
        toast.error("Couldn't end it. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence initial={false}>
      {freeze && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn("overflow-hidden", className)}
          role="status"
        >
          <div
            className={cn(
              "flex flex-col gap-2 border-b px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-10",
              freeze.kind === "incident"
                ? "bg-gate-denied-bg text-gate-denied-fg"
                : "bg-gate-pending-bg text-gate-pending-fg",
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {freeze.kind === "incident" ? (
                <Siren className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <p className="min-w-0">
                <span className="font-semibold" suppressHydrationWarning>
                  {freezeLabel(freeze.kind)} until {untilTime(freeze.until)}
                </span>
                {freeze.reason && <span>: {freeze.reason}</span>}
                <span className="block text-xs opacity-90">
                  {FREEZE_RULES} Started by {freeze.by}{" "}
                  <span suppressHydrationWarning>{timeAgo(freeze.startedAt)}</span>.
                </span>
              </p>
            </div>
            {canEnd && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-current/30 bg-transparent text-current hover:bg-background/40"
                onClick={end}
                disabled={busy}
              >
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                End now
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
