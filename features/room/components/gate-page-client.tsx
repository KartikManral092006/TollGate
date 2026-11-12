"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { GateView } from "@/features/gates/shared/view";
import { usePresence } from "@/features/presence/client/use-presence";
import { presenceFor } from "@/features/presence/shared/presence";
import { useGateActions } from "@/features/room/client/use-gate-actions";
import { GateCard, type Viewer } from "@/features/room/components/gate-card";
import { clockTime, timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

type Event = { at: string | null; text: string; tone: "neutral" | "good" | "bad" | "wait" };

// Everything that happened to a gate, oldest first.
export function timeline(gate: GateView): Event[] {
  const events: Event[] = [
    gate.status === "bypassed"
      ? {
          at: gate.createdAt,
          text: `${gate.requester.name}'s agent ran it without approval (TOLLGATE_BYPASS=1)`,
          tone: "bad",
        }
      : { at: gate.createdAt, text: `${gate.requester.name}'s agent raised it`, tone: "wait" },
  ];
  if (gate.review) {
    events.push({
      at: gate.review.at,
      text: `${gate.review.by} reviewed it${gate.review.note ? `: "${gate.review.note}"` : ""}`,
      tone: "good",
    });
  }
  if (gate.ran) {
    events.push({
      at: gate.ran.at,
      text:
        gate.ran.outcome === "succeeded"
          ? "It ran and succeeded"
          : gate.ran.outcome === "failed"
            ? `It ran and failed${gate.ran.exitCode ? ` (exit ${gate.ran.exitCode})` : ""}`
            : "It was stopped before it finished",
      tone:
        gate.ran.outcome === "failed"
          ? "bad"
          : gate.ran.outcome === "succeeded"
            ? "good"
            : "neutral",
    });
  }
  for (const vote of gate.votes) {
    const asked = gate.question && vote.decision === "deny";
    events.push({
      at: vote.at,
      text: `${vote.name} ${vote.decision === "approve" ? "approved" : asked ? "asked a question" : "denied"}${vote.reason ? `: "${vote.reason}"` : ""}`,
      tone: vote.decision === "approve" ? "good" : asked ? "wait" : "bad",
    });
  }
  if (gate.parkedAt) {
    events.push({ at: gate.parkedAt, text: "Parked: nobody decided in time", tone: "neutral" });
  }
  if (gate.rule?.action === "auto_approve") {
    events.push({ at: gate.decidedAt, text: "Approved on arrival by a team rule", tone: "good" });
  }
  if (gate.grant?.usedAt) {
    events.push({
      at: gate.grant.usedAt,
      text: "The agent's retry used the approval",
      tone: "good",
    });
  }
  if (gate.status === "expired") {
    events.push({ at: null, text: "Expired without a decision", tone: "neutral" });
  }
  return events.sort((a, b) => (a.at === null ? 1 : b.at === null ? -1 : a.at.localeCompare(b.at)));
}

const TONE: Record<Event["tone"], string> = {
  neutral: "bg-gate-parked",
  good: "bg-gate-approved",
  bad: "bg-gate-denied",
  wait: "bg-gate-pending",
};

export function GatePageClient({
  teamId,
  viewer,
  initial,
  members,
}: {
  teamId: string;
  viewer: Viewer;
  initial: GateView;
  members: { id: string; name: string }[];
}) {
  const [gate, setGate] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/gates/${initial.id}`, { cache: "no-store" });
      if (response.ok) setGate(((await response.json()) as { gate: GateView }).gate);
    } catch {
      // offline for a moment; the next tick catches up
    }
  }, [initial.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const actions = useGateActions({ refresh });
  const people = usePresence(teamId, {
    viewing: gate.id,
    typing: actions.composing?.id ?? null,
  });
  const ids = presenceFor(gate.id, people, viewer.id);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "A teammate";
  const presence = { looking: ids.looking.map(nameOf), typing: ids.typing.map(nameOf) };

  return (
    <>
      <PageHeader
        title={<span className="font-mono">TG-{gate.code}</span>}
        description={`${gate.repo}, ${gate.preset}`}
        actions={
          <Link
            href={`/teams/${teamId}?gate=${gate.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <ArrowLeft /> In the room
          </Link>
        }
      />
      <div className="grid flex-1 content-start items-start gap-x-12 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,48rem)_minmax(0,18rem)] lg:px-10">
        <GateCard
          gate={gate}
          viewer={viewer}
          contextOpen
          onApprove={async (target, note, windowMinutes) => {
            await actions.approve(target, note, windowMinutes);
          }}
          onEndWindow={actions.endWindow}
          onDeny={actions.deny}
          onAsk={actions.ask}
          onWhy={actions.explain}
          onShareWhy={actions.shareWhy}
          presence={presence}
        />
        <aside className="py-5">
          <h2 className="text-sm font-bold">Timeline</h2>
          <ol className="relative mt-3 flex flex-col gap-4 border-s ps-5">
            {timeline(gate).map((event, index) => (
              <li key={index} className="relative text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-background",
                    TONE[event.tone],
                  )}
                />
                <p>{event.text}</p>
                {event.at && (
                  <p
                    className="text-xs text-muted-foreground"
                    title={new Date(event.at).toLocaleString()}
                    // Relative time: the server's render is older than the browser's.
                    suppressHydrationWarning
                  >
                    {timeAgo(event.at)}, {clockTime(event.at)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
      {actions.drawers}
    </>
  );
}
