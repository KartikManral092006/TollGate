"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { GateView } from "@/features/gates/shared/view";
import { DenyDrawer } from "@/features/room/components/deny-drawer";
import type { WhyResult } from "@/features/why/shared/providers";

const VOTE_ERRORS: Record<string, string> = {
  closed: "This gate was already decided.",
  voted: "You already voted on this gate.",
  own_gate: "You can't approve your own agent's command.",
  not_waiting:
    "The agent has stopped waiting, so it can't hear a question now. Approve or deny instead.",
  not_allowed: "Your role can't vote in this team.",
  rate_limited: "Too many votes. Try again in a minute.",
};

// Approve, deny with a reason, ask, and "Why?" for a gate, shared by the room, a gate's own
// page and review mode, so all three behave the same. `drawers` must be rendered once.
export function useGateActions({
  refresh,
  repliesFor,
}: {
  refresh: () => Promise<void> | void;
  // A gate's chat replies, offered as deny reasons (the room has them; other pages don't).
  repliesFor?: (gate: GateView) => { id: string; name: string; text: string }[];
}) {
  const [denying, setDenying] = useState<GateView | null>(null);
  const [asking, setAsking] = useState<GateView | null>(null);

  async function vote(gate: GateView, decision: "approve" | "deny", reason?: string) {
    const response = await fetch(`/api/gates/${gate.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { decision, reason } : { decision }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(VOTE_ERRORS[body.error ?? ""] ?? "Your vote didn't go through. Try again.");
      void refresh();
      return false;
    }
    const result = (await response.json()) as { status: string; approvals: number; quorum: number };
    if (decision === "deny") toast.success(`Denied TG-${gate.code}. The agent gets your reason.`);
    else if (result.status === "approved") toast.success(`TG-${gate.code} approved`);
    else toast.success(`Approved, ${result.approvals} of ${result.quorum} so far`);
    void refresh();
    return true;
  }

  async function ask(gate: GateView, question: string) {
    const response = await fetch(`/api/gates/${gate.id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    void refresh();
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(VOTE_ERRORS[body.error ?? ""] ?? "Your question didn't go through. Try again.");
      return false;
    }
    toast.success(`Question sent on TG-${gate.code}. The agent answers when it tries again.`);
    return true;
  }

  async function explain(gate: GateView): Promise<WhyResult | null> {
    const response = await fetch(`/api/gates/${gate.id}/why`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return null;
    return (await response.json()) as WhyResult;
  }

  const drawers = (
    <>
      <DenyDrawer
        gate={denying}
        onClose={() => setDenying(null)}
        onSubmit={(gate, reason) => vote(gate, "deny", reason)}
        replies={denying && repliesFor ? repliesFor(denying) : []}
      />
      <DenyDrawer gate={asking} mode="ask" onClose={() => setAsking(null)} onSubmit={ask} />
    </>
  );

  return {
    approve: (gate: GateView, note?: string) => vote(gate, "approve", note),
    deny: setDenying,
    ask: setAsking,
    explain,
    // Which gate has a drawer open, and why: the room reports it as "typing".
    composing: denying ?? asking,
    drawers,
  };
}
