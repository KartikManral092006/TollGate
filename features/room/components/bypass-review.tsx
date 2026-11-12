"use client";

import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GateView } from "@/features/gates/shared/view";
import { timeAgo } from "@/features/room/shared/format";

// A call that went through with TOLLGATE_BYPASS=1: nobody decided, so someone who could have
// looks at it afterwards. Anyone who can vote may mark it reviewed, except the person whose
// agent ran it.
export function BypassReview({
  gate,
  viewer,
}: {
  gate: GateView;
  viewer: { id: string; canVote: boolean; name?: string };
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Shown at once; the room's next refresh brings the stored review.
  const [local, setLocal] = useState<NonNullable<GateView["review"]> | null>(null);
  if (gate.status !== "bypassed") return null;

  const review = gate.review ?? local;
  const mine = gate.requester.id === viewer.id;
  const canReview = !review && viewer.canVote && !mine;

  async function markReviewed() {
    setBusy(true);
    try {
      const response = await fetch(`/api/gates/${gate.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
      });
      if (!response.ok) {
        toast.error("Couldn't mark it reviewed. Try again.");
        return;
      }
      setLocal({ by: "You", at: new Date().toISOString(), note: note.trim() || null });
      toast.success(`TG-${gate.code} marked reviewed.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-gate-denied/30 bg-gate-denied-bg px-3 py-2.5 text-sm">
      <p className="flex items-start gap-2 text-gate-denied-fg">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Ran without the team.</span>{" "}
          {mine ? "You" : gate.requester.name} started Claude Code with{" "}
          <code className="font-mono text-xs">TOLLGATE_BYPASS=1</code>, so nobody approved this.
        </span>
      </p>
      {review ? (
        <p className="flex items-start gap-2 text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gate-approved-fg" aria-hidden />
          <span>
            Reviewed by <span className="font-medium">{review.by}</span>{" "}
            <span className="text-muted-foreground" suppressHydrationWarning>
              {timeAgo(review.at)}
            </span>
            {review.note && <span className="text-muted-foreground">: {review.note}</span>}
          </span>
        </p>
      ) : canReview ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            aria-label={`What you found when reviewing TG-${gate.code}`}
            placeholder="What you checked, e.g. hotfix for the outage, deploy looks right"
            className="h-10 bg-background text-base sm:h-9 sm:text-sm"
          />
          <Button className="h-10 shrink-0 sm:h-9" onClick={markReviewed} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
            Mark reviewed
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {mine
            ? "A teammate will look at what it did and mark it reviewed."
            : "Waiting for someone who can approve to review it."}
        </p>
      )}
    </div>
  );
}
