"use client";

import { ArrowDown, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOLD_MS } from "@/components/hold-button";
import { AllClear } from "@/components/road/all-clear";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { isOpenStatus, mergeGates, type GateView } from "@/features/gates/shared/view";
import { usePresence } from "@/features/presence/client/use-presence";
import { presenceFor } from "@/features/presence/shared/presence";
import { useGateActions } from "@/features/room/client/use-gate-actions";
import { GateCard, needsHold, type Viewer } from "@/features/room/components/gate-card";
import type { WhyResult } from "@/features/why/shared/providers";

const SHORTCUTS: [string, string][] = [
  ["J", "Next gate"],
  ["K", "Previous gate"],
  ["A", "Approve (hold on risky gates)"],
  ["D", "Deny with a reason"],
  ["Q", "Ask the agent"],
  ["W", "Why? on or off"],
  ["Esc", "Back to the room"],
];

// Oldest first: the one closest to parking.
export function reviewQueue(gates: GateView[]): GateView[] {
  return gates
    .filter((gate) => isOpenStatus(gate.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const typingInField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function ReviewClient({
  teamId,
  viewer,
  initialGates,
  members,
}: {
  teamId: string;
  viewer: Viewer;
  initialGates: GateView[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [gates, setGates] = useState(initialGates);
  const queue = useMemo(() => reviewQueue(gates), [gates]);
  const [currentId, setCurrentId] = useState<string | null>(queue[0]?.id ?? null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [why, setWhy] = useState<{ gateId: string; result: WhyResult | null } | "loading" | null>(
    null,
  );
  const [showWhy, setShowWhy] = useState(true);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay on the same gate as the queue changes; when it leaves (decided), take its place.
  const index = Math.max(
    0,
    queue.findIndex((gate) => gate.id === currentId),
  );
  const current =
    queue.find((gate) => gate.id === currentId) ?? queue[index] ?? queue.at(-1) ?? null;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/gates`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { gates: GateView[] };
      setGates((existing) => mergeGates(existing, body.gates));
    } catch {
      // offline for a moment
    }
  }, [teamId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const actions = useGateActions({ refresh });
  const people = usePresence(teamId, {
    viewing: current?.id ?? null,
    typing: actions.composing?.id ?? null,
  });
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "A teammate";

  // The explanation for the gate in front of you, fetched as you arrive.
  const currentKey = current?.id ?? null;
  useEffect(() => {
    if (!current || !showWhy) return;
    let cancelled = false;
    const start = setTimeout(() => setWhy("loading"), 0);
    actions
      .explain(current)
      .then((result) => {
        if (!cancelled) setWhy({ gateId: current.id, result });
      })
      .catch(() => {
        if (!cancelled) setWhy({ gateId: current.id, result: null });
      });
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
    // Only when the gate in front of you changes, not on every refresh of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, showWhy]);

  const move = useCallback(
    (step: 1 | -1) => {
      if (queue.length === 0) return;
      const next = queue[Math.min(queue.length - 1, Math.max(0, index + step))];
      if (!next) return;
      setDirection(step);
      setCurrentId(next.id);
    },
    [queue, index],
  );

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  };

  useEffect(() => {
    const canVote = (gate: GateView) =>
      viewer.canVote &&
      gate.requester.id !== viewer.id &&
      !gate.votes.some((vote) => vote.userId === viewer.id);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typingInField(event.target)) return;
      if (actions.composing) return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "arrowdown") {
        event.preventDefault();
        move(1);
      } else if (key === "k" || key === "arrowup") {
        event.preventDefault();
        move(-1);
      } else if (key === "escape") {
        router.push(`/teams/${teamId}`);
      } else if (key === "w") {
        setShowWhy((value) => !value);
      } else if (current && canVote(current)) {
        if (key === "d") {
          event.preventDefault();
          actions.deny(current);
        } else if (key === "q" && current.status === "pending") {
          event.preventDefault();
          actions.ask(current);
        } else if (key === "a" && !event.repeat) {
          event.preventDefault();
          if (!needsHold(current)) {
            void actions.approve(current);
            return;
          }
          const gate = current;
          setHolding(true);
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null;
            setHolding(false);
            void actions.approve(gate);
          }, HOLD_MS);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a") cancelHold();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [actions, current, move, router, teamId, viewer]);

  const presence = current ? presenceFor(current.id, people, viewer.id) : null;
  const whyResult =
    why !== null && why !== "loading" && why.gateId === current?.id ? why.result : null;

  return (
    <>
      <PageHeader
        title="Review"
        description={
          queue.length === 0
            ? "Nothing is waiting."
            : `${queue.length} waiting, oldest first. Use the keyboard to move and decide.`
        }
        actions={
          queue.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground tabular-nums">
                {index + 1} of {queue.length}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous gate"
                onClick={() => move(-1)}
                disabled={index === 0}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next gate"
                onClick={() => move(1)}
                disabled={index >= queue.length - 1}
              >
                <ArrowDown />
              </Button>
            </div>
          )
        }
      />

      {/* How far through the queue you are. */}
      {queue.length > 0 && (
        <div className="h-0.5 bg-border" aria-hidden>
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${((index + 1) / queue.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
          />
        </div>
      )}

      {current === null ? (
        <main className="flex flex-1 items-start px-4 py-16 sm:px-6 lg:px-10">
          <AllClear
            large
            title="Queue empty"
            description="Every gate has been decided. Nice work."
          />
        </main>
      ) : (
        <main className="grid flex-1 content-start items-start gap-x-12 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,48rem)_minmax(0,20rem)] lg:px-10">
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current.id}
                custom={direction}
                initial={{ opacity: 0, y: direction * 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction * -24 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              >
                <GateCard
                  gate={current}
                  viewer={viewer}
                  contextOpen
                  onApprove={async (gate, note) => {
                    await actions.approve(gate, note);
                  }}
                  onDeny={actions.deny}
                  onAsk={actions.ask}
                  presence={
                    presence
                      ? {
                          looking: presence.looking.map(nameOf),
                          typing: presence.typing.map(nameOf),
                        }
                      : undefined
                  }
                />
              </motion.div>
            </AnimatePresence>
            {/* Holding A on a risky gate: the same fill as the button. */}
            <AnimatePresence>
              {holding && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-1.5 bg-border"
                >
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: HOLD_MS / 1000, ease: "linear" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="flex flex-col gap-8 py-5">
            {showWhy && (
              <section>
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand">
                  <Sparkles className="size-4" aria-hidden /> Why?
                </h2>
                {why === null || why === "loading" || why.gateId !== current.id ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Explaining…
                  </p>
                ) : (
                  <div className="mt-2 border-s-2 border-brand ps-3 text-sm">
                    <p className="whitespace-pre-wrap">
                      {whyResult?.text ??
                        "Couldn't explain this one right now. Read the command and context."}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {whyResult?.source === "ai" ? "AI explanation" : "Built-in explanation"}. The
                      decision is yours.
                    </p>
                  </div>
                )}
              </section>
            )}
            <section>
              <h2 className="text-sm font-bold">Keyboard</h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
                {SHORTCUTS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt>
                      <Kbd>{key}</Kbd>
                    </dt>
                    <dd className="text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </main>
      )}
      {actions.drawers}
    </>
  );
}
