"use client";

import {
  ChevronDown,
  EyeOff,
  GitBranch,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { HoldButton } from "@/components/hold-button";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  displayStatus,
  isOpenStatus,
  type GateDisplayStatus,
  type GateView,
} from "@/features/gates/shared/view";
import { PrecedentNote } from "@/features/insights/components/precedent-note";
import { RiskSignals } from "@/features/insights/components/risk-signals";
import { SuggestedApprovers } from "@/features/insights/components/suggested-approvers";
import type { WhyResult } from "@/features/why/shared/providers";
import { EnvBadge, STATUS } from "@/features/room/components/gate-status";
import { ParkCountdown } from "@/features/room/components/park-countdown";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime, timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

export type Viewer = { id: string; canVote: boolean };

const DOT: Record<GateDisplayStatus, string> = {
  pending: "bg-gate-pending",
  asked: "bg-gate-pending",
  approved: "bg-gate-approved",
  denied: "bg-gate-denied",
  parked: "bg-gate-parked",
  expired: "bg-gate-parked",
};

const TEXT: Record<GateDisplayStatus, string> = {
  pending: "text-gate-pending-fg",
  asked: "text-gate-pending-fg",
  approved: "text-gate-approved-fg",
  denied: "text-gate-denied-fg",
  parked: "text-muted-foreground",
  expired: "text-muted-foreground",
};

function QuorumDots({ approvals, quorum }: { approvals: number; quorum: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${approvals} of ${quorum} approvals`}
    >
      {Array.from({ length: quorum }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full transition-colors duration-300",
            i < approvals ? "bg-gate-approved" : "bg-border",
          )}
        />
      ))}
      <span className="ms-1 text-xs text-muted-foreground tabular-nums">
        {Math.min(approvals, quorum)}/{quorum}
      </span>
    </span>
  );
}

function outcomeLine(gate: GateView): string | null {
  switch (gate.status) {
    case "approved": {
      const names = gate.votes.filter((v) => v.decision === "approve").map((v) => v.name);
      const by = names.length > 0 ? `Approved by ${names.join(", ")}` : "Approved";
      if (!gate.grant) return null;
      return `${by} after parking, ${gate.grant.usedAt ? "and the agent's retry used it" : "so the agent's retry passes within 24 h"}.`;
    }
    case "parked":
      return "Nobody decided in time. The agent moved on; approving now lets its retry pass.";
    case "expired":
      return "Expired without a decision.";
    default:
      return null;
  }
}

// A note with a coloured edge instead of a box: the thread stays one flat timeline.
function Note({
  tone,
  label,
  children,
}: {
  tone: "signal" | "approved" | "denied" | "pending" | "brand";
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  const edge = {
    signal: "border-signal",
    approved: "border-gate-approved",
    denied: "border-gate-denied",
    pending: "border-gate-pending",
    brand: "border-brand",
  }[tone];
  return (
    <div className={cn("border-s-2 ps-3 text-sm", edge)}>
      {label && <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{label}</p>}
      {children}
    </div>
  );
}

// One gate in the room's thread. Not a card: the requester's avatar on the left with a line in
// the gate's colour running down beside everything about it, divided from the next entry by a
// hairline, like the rest of the app.
export function GateCard({
  gate,
  viewer,
  highlighted = false,
  onApprove,
  onDeny,
  onAsk,
  onRing,
  onWhy,
  footer,
}: {
  gate: GateView;
  viewer: Viewer;
  highlighted?: boolean;
  footer?: React.ReactNode;
  // Plain-language explanation: the team's AI provider, or the built-in rules.
  onWhy?: (gate: GateView) => Promise<WhyResult | null>;
  onApprove: (gate: GateView) => Promise<void>;
  onDeny: (gate: GateView) => void;
  // Ask the agent a question instead of deciding; only while its hook is still waiting.
  onAsk?: (gate: GateView) => void;
  // Ring a suggested approver; only when calls are available.
  onRing?: (gate: GateView, userId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [why, setWhy] = useState<{
    state: "loading" | "done" | "error";
    result?: WhyResult;
  } | null>(null);

  async function explain() {
    if (!onWhy || why?.state === "loading") return;
    if (why?.state === "done") {
      setWhy(null);
      return;
    }
    setWhy({ state: "loading" });
    try {
      const result = await onWhy(gate);
      setWhy(result ? { state: "done", result } : { state: "error" });
    } catch {
      setWhy({ state: "error" });
    }
  }
  const shown = displayStatus(gate);
  const meta = STATUS[shown];
  const open = isOpenStatus(gate.status);
  const mine = gate.requester.id === viewer.id;
  const voted = gate.votes.some((vote) => vote.userId === viewer.id);
  const canAct = open && viewer.canVote && !mine && !voted;
  const canAsk = canAct && onAsk !== undefined && gate.status === "pending";
  const denial = gate.votes.find((vote) => vote.decision === "deny");
  const outcome = outcomeLine(gate);
  // Where a wrong yes is expensive, approving takes a deliberate hold instead of a tap.
  const holdToApprove =
    gate.env === "prod" || (gate.insights?.signals ?? []).some((s) => s.level === "high");

  async function approve() {
    setBusy(true);
    try {
      await onApprove(gate);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout="position"
      id={`gate-${gate.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      aria-label={`Gate TG-${gate.code}, ${meta.label}`}
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b py-5 transition-colors sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-x-4",
        highlighted && "-mx-3 rounded-md bg-signal/10 px-3",
      )}
    >
      {/* Who asked, and the gate's state as a line running down beside it. */}
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <PersonAvatar id={gate.requester.id} name={gate.requester.name} />
        <motion.span
          aria-hidden
          layout
          className={cn("w-0.5 flex-1 rounded-full transition-colors duration-300", DOT[shown])}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <header className="flex flex-col gap-1">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">
                {mine ? "Your agent" : `${gate.requester.name}'s agent`}
              </span>{" "}
              <span className="text-muted-foreground">wants to run</span>{" "}
              <span className="font-mono font-bold">TG-{gate.code}</span>
            </p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={shown}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 text-sm font-semibold",
                  TEXT[shown],
                )}
              >
                <span aria-hidden className={cn("size-2 rounded-full", DOT[shown])} />
                {meta.label}
              </motion.span>
            </AnimatePresence>
          </div>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <EnvBadge env={gate.env} />
            <span>{gate.preset}</span>
            <span className="truncate font-mono">{gate.repo}</span>
            {gate.branch && (
              <span className="flex min-w-0 items-center gap-1">
                <GitBranch className="size-3 shrink-0" aria-hidden />
                <span className="truncate font-mono">{gate.branch}</span>
              </span>
            )}
            <time dateTime={gate.createdAt} title={clockTime(gate.createdAt)}>
              {timeAgo(gate.createdAt)}
            </time>
            {gate.status === "pending" && gate.parksAt && (
              <ParkCountdown
                createdAt={gate.createdAt}
                parksAt={gate.parksAt}
                className="ms-auto"
              />
            )}
          </p>
        </header>

        {gate.followUp && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Retry after {gate.followUp.askedBy}&apos;s question in TG-{gate.followUp.code}:{" "}
              <span className="text-foreground italic">&ldquo;{gate.followUp.question}&rdquo;</span>
            </span>
          </p>
        )}

        {gate.intent ? (
          <Note
            tone="signal"
            label={
              gate.followUp
                ? "The agent's answer, in its own words"
                : "The agent's reason, in its own words"
            }
          >
            &ldquo;{gate.intent}&rdquo;
          </Note>
        ) : (
          gate.followUp && (
            <Note tone="pending">
              <span className="text-gate-pending-fg">
                The agent ran the command again without answering the question.
              </span>
            </Note>
          )
        )}

        {open && gate.insights && <RiskSignals signals={gate.insights.signals} />}
        {open && gate.insights?.precedent && <PrecedentNote precedent={gate.insights.precedent} />}

        {/* The command on the road, as the agent typed it. */}
        <CodeBlock size="sm" className="border-0 bg-asphalt text-white dark:bg-asphalt">
          <CodeBlockContent wrap className="pe-11! text-[13px] break-all">
            {/* One span: the code element is a grid, so siblings would stack. */}
            <span>
              <span aria-hidden className="text-white/45 select-none">
                ❯{" "}
              </span>
              {gate.command}
            </span>
          </CodeBlockContent>
          <CodeBlockActions>
            <CodeBlockCopyButton
              value={gate.command}
              className="bg-white/10! text-white/80 ring-white/20! hover:bg-white/20! hover:text-white"
            />
          </CodeBlockActions>
        </CodeBlock>

        {gate.via && (
          <div className="-mt-1 flex flex-col gap-0.5 text-xs">
            <span className="font-semibold text-muted-foreground">What it really runs</span>
            {gate.via.split("\n").map((line) => {
              const [from, ...rest] = line.split(" → ");
              return (
                <p key={line} className="font-mono break-all">
                  <span className="text-muted-foreground">{from} →</span> {rest.join(" → ")}
                </p>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {gate.redactions > 0 && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex items-center gap-1" />}>
                <EyeOff className="size-3.5" aria-hidden />
                {gate.redactions} {gate.redactions === 1 ? "secret" : "secrets"} hidden
              </TooltipTrigger>
              <TooltipContent>
                Redacted on the developer&apos;s machine before sending
              </TooltipContent>
            </Tooltip>
          )}
          {gate.mode === "guard" && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" aria-hidden />
              Guard mode
            </span>
          )}
          {gate.context && (
            <button
              type="button"
              onClick={() => setShowContext((value) => !value)}
              aria-expanded={showContext}
              className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Context
              <ChevronDown
                className={cn("size-3.5 transition-transform", showContext && "rotate-180")}
                aria-hidden
              />
            </button>
          )}
          {onWhy && (
            <button
              type="button"
              onClick={explain}
              aria-expanded={why?.state === "done"}
              className="inline-flex items-center gap-1 rounded-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {why?.state === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
              Why?
            </button>
          )}
          <span className="ms-auto">
            <QuorumDots approvals={gate.approvals} quorum={gate.quorum} />
          </span>
        </div>

        <AnimatePresence initial={false}>
          {showContext && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-60 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs whitespace-pre-wrap"
            >
              {gate.context}
            </motion.pre>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {why && why.state !== "loading" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              role="note"
            >
              <Note
                tone="brand"
                label={
                  <span className="flex flex-wrap items-center gap-1 text-brand">
                    <Sparkles className="size-3.5" aria-hidden />
                    {why.result?.source === "ai"
                      ? `AI explanation${why.result.model ? `, ${why.result.model}` : ""}`
                      : "Built-in explanation"}
                    <span className="font-normal text-muted-foreground">
                      (the decision is yours)
                    </span>
                  </span>
                }
              >
                <p className="whitespace-pre-wrap">
                  {why.state === "done" && why.result
                    ? why.result.text
                    : "Couldn't explain this one right now. Read the command and context, or ask the requester."}
                </p>
                {why.result?.fallback && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Your team&apos;s AI provider didn&apos;t answer, so this is the built-in
                    explanation.
                  </p>
                )}
              </Note>
            </motion.div>
          )}
        </AnimatePresence>

        {gate.votes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {gate.votes.map((vote) => (
              <motion.li
                key={vote.userId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 text-sm"
              >
                <PersonAvatar id={vote.userId} name={vote.name} size="sm" />
                <span className="min-w-0">
                  <span className="font-medium">{vote.name}</span>{" "}
                  <span
                    className={
                      vote.decision === "approve"
                        ? "text-gate-approved-fg"
                        : shown === "asked" && vote === denial
                          ? "text-gate-pending-fg"
                          : "text-gate-denied-fg"
                    }
                  >
                    {vote.decision === "approve"
                      ? "approved"
                      : shown === "asked" && vote === denial
                        ? "asked a question"
                        : "denied"}
                  </span>
                  {vote.reason && !(gate.status === "denied" && vote === denial) && (
                    <span className="text-muted-foreground">: {vote.reason}</span>
                  )}
                </span>
              </motion.li>
            ))}
          </ul>
        )}

        {shown === "asked" && gate.question ? (
          <Note tone="pending" label="Sent to the agent to answer">
            &ldquo;{gate.question}&rdquo;{" "}
            <span className="text-muted-foreground">
              {gate.answeredIn
                ? `Its answer is in TG-${gate.answeredIn}.`
                : "Its answer arrives with its next try."}
            </span>
          </Note>
        ) : (
          gate.status === "denied" &&
          denial?.reason && (
            <Note tone="denied" label="Sent to the agent as its next instruction">
              <span className="text-gate-denied-fg">&ldquo;{denial.reason}&rdquo;</span>
            </Note>
          )
        )}
        {outcome && <p className="text-xs text-muted-foreground">{outcome}</p>}
        {gate.rule && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ListChecks className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {gate.rule.action === "auto_approve"
                ? "Approved on arrival by a team rule"
                : "Needs one approval by a team rule"}{" "}
              for {gate.rule.preset} on {gate.rule.env} in {gate.repo}
              {gate.rule.by ? `, added by ${gate.rule.by}` : ""}.
            </span>
          </p>
        )}

        {open && gate.insights && gate.insights.approvers.length > 0 && (
          <SuggestedApprovers
            approvers={gate.insights.approvers}
            viewerId={viewer.id}
            preset={gate.preset}
            repo={gate.repo}
            onRing={onRing ? (userId) => onRing(gate, userId) : undefined}
          />
        )}

        {canAct && (
          // Full-width, thumb-sized on phones; a compact row on the right on wider screens.
          <div
            className={cn(
              "grid gap-2 sm:flex sm:justify-end",
              canAsk ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {canAsk && (
              <Button
                variant="ghost"
                className="h-11 sm:h-9"
                onClick={() => onAsk?.(gate)}
                disabled={busy}
              >
                <MessageCircleQuestion aria-hidden />
                Ask…
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 border-gate-denied/40 text-gate-denied-fg hover:bg-gate-denied-bg hover:text-gate-denied-fg sm:h-9"
              onClick={() => onDeny(gate)}
              disabled={busy}
            >
              <ThumbsDown aria-hidden />
              Deny…
            </Button>
            {holdToApprove ? (
              <HoldButton
                className="h-11 sm:h-9 sm:px-5"
                onHold={() => void approve()}
                disabled={busy}
                label={`Hold to approve TG-${gate.code}`}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ThumbsUp aria-hidden />}
                Hold to approve
              </HoldButton>
            ) : (
              <Button className="h-11 sm:h-9 sm:px-5" onClick={approve} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ThumbsUp aria-hidden />}
                Approve
              </Button>
            )}
          </div>
        )}
        {canAct && holdToApprove && (
          <p className="-mt-1 text-xs text-muted-foreground sm:text-end">
            {gate.env === "prod" ? "Production" : "High risk"}: press and hold Approve for a second.
          </p>
        )}
        {open && mine && (
          <p className="text-xs text-muted-foreground">
            Waiting for your team. You can&apos;t approve your own agent&apos;s command.
          </p>
        )}
        {open && voted && !mine && (
          <p className="text-xs text-muted-foreground">
            You voted. Waiting for the rest of the quorum.
          </p>
        )}
        {footer}
      </div>
    </motion.article>
  );
}
