"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { GateView } from "@/features/gates/shared/view";
import { windowKind } from "@/features/gates/shared/windows";
import { DenyDrawer } from "@/features/room/components/deny-drawer";
import type { WhyResult } from "@/features/why/shared/providers";

const VOTE_ERRORS: Record<string, string> = {
  closed: "This gate was already decided.",
  voted: "You already voted on this gate.",
  own_gate: "You can't approve your own agent's command.",
  not_waiting:
    "The agent has stopped waiting, so it can't hear a question now. Approve or deny instead.",
  not_allowed: "Your role can't vote in this team.",
  window_not_allowed:
    "This gate can't open a window (production, two approvals, or a high-risk kind). Approve it on its own.",
  rate_limited: "Too many votes. Try again in a minute.",
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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

  async function vote(
    gate: GateView,
    decision: "approve" | "deny",
    reason?: string,
    windowMinutes?: number,
  ) {
    const response = await fetch(`/api/gates/${gate.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        ...(reason ? { reason } : {}),
        ...(windowMinutes ? { windowMinutes } : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(VOTE_ERRORS[body.error ?? ""] ?? "Your vote didn't go through. Try again.");
      void refresh();
      return false;
    }
    const result = (await response.json()) as {
      status: string;
      approvals: number;
      quorum: number;
      windowUntil?: string | null;
    };
    if (decision === "deny") toast.success(`Denied TG-${gate.code}. The agent gets your reason.`);
    else if (result.windowUntil) {
      toast.success(
        `TG-${gate.code} approved. ${gate.requester.name}'s agent can run ${windowKind(gate)} without asking until ${clock(result.windowUntil)}.`,
      );
    } else if (result.status === "approved") toast.success(`TG-${gate.code} approved`);
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

  async function endWindow(windowId: string) {
    const response = await fetch(`/api/windows/${windowId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    void refresh();
    if (!response.ok) {
      toast.error("Couldn't end the window. Try again.");
      return;
    }
    toast.success("Window ended. The agent's next gate of that kind asks again.");
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
    approve: (gate: GateView, note?: string, windowMinutes?: number) =>
      vote(gate, "approve", note, windowMinutes),
    endWindow,
    deny: setDenying,
    ask: setAsking,
    explain,
    // Which gate has a drawer open, and why: the room reports it as "typing".
    composing: denying ?? asking,
    drawers,
  };
}
