"use client";

import {
  Sparkles,
  ChevronDown,
  EyeOff,
  GitBranch,
  Loader2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isOpenStatus, type GateView } from "@/features/gates/shared/view";
import type { WhyResult } from "@/features/why/shared/providers";
import { EnvBadge, STATUS, StatusChip } from "@/features/room/components/gate-status";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { clockTime, timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

export type Viewer = { id: string; canVote: boolean };

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
      return `${by} after parking · ${gate.grant.usedAt ? "the agent's retry used it" : "the agent's retry passes within 24 h"}`;
    }
    case "parked":
      return "Nobody decided in time. The agent moved on; approving now lets its retry pass.";
    case "expired":
      return "Expired without a decision.";
    default:
      return null;
  }
}

export function GateCard({
  gate,
  viewer,
  highlighted = false,
  onApprove,
  onDeny,
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
  const meta = STATUS[gate.status];
  const open = isOpenStatus(gate.status);
  const mine = gate.requester.id === viewer.id;
  const voted = gate.votes.some((vote) => vote.userId === viewer.id);
  const canAct = open && viewer.canVote && !mine && !voted;
  const denial = gate.votes.find((vote) => vote.decision === "deny");
  const outcome = outcomeLine(gate);

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
      layout
      id={`gate-${gate.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      aria-label={`Gate TG-${gate.code}, ${meta.label}`}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs",
        highlighted && "ring-2 ring-brand/60",
      )}
    >
      <motion.span
        aria-hidden
        layout
        className={cn("absolute inset-y-0 start-0 w-1", meta.stripe)}
      />
      <div className="flex flex-col gap-3 p-3 ps-4 sm:p-4 sm:ps-5">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm font-semibold">TG-{gate.code}</span>
          <EnvBadge env={gate.env} />
          <span className="text-xs text-muted-foreground">{gate.preset}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={gate.status}
              className="ms-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
            >
              <StatusChip status={gate.status} />
            </motion.span>
          </AnimatePresence>
        </header>

        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <PersonAvatar id={gate.requester.id} name={gate.requester.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-medium text-foreground">
                {mine ? "Your agent" : `${gate.requester.name}'s agent`}
              </span>{" "}
              wants to run
            </p>
            <p className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono">{gate.repo}</span>
              {gate.branch && (
                <>
                  <GitBranch className="ms-1 size-3 shrink-0" aria-hidden />
                  <span className="truncate font-mono">{gate.branch}</span>
                </>
              )}
              <span aria-hidden className="shrink-0">
                ·
              </span>
              <time
                className="shrink-0"
                dateTime={gate.createdAt}
                title={clockTime(gate.createdAt)}
              >
                {timeAgo(gate.createdAt)}
              </time>
            </p>
          </div>
        </div>

        <CodeBlock size="sm" className="bg-muted/60">
          <CodeBlockContent wrap className="pe-11! text-[13px] break-all">
            {gate.command}
          </CodeBlockContent>
          <CodeBlockActions>
            <CodeBlockCopyButton value={gate.command} />
          </CodeBlockActions>
        </CodeBlock>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
              className="max-h-60 overflow-auto rounded-lg border bg-muted/40 p-2.5 font-mono text-xs whitespace-pre-wrap"
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
              className="overflow-hidden rounded-lg border border-brand/25 bg-brand/5 px-3 py-2.5 text-sm"
              role="note"
            >
              <p className="mb-1 flex flex-wrap items-center gap-1 text-xs font-medium text-brand">
                <Sparkles className="size-3.5" aria-hidden />
                {why.result?.source === "ai"
                  ? `AI explanation${why.result.model ? ` · ${why.result.model}` : ""}`
                  : "Built-in explanation"}
                <span className="font-normal text-muted-foreground">· the decision is yours</span>
              </p>
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
            </motion.div>
          )}
        </AnimatePresence>

        {gate.votes.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {gate.votes.map((vote) => (
              <li key={vote.userId} className="flex items-start gap-2 text-sm">
                <PersonAvatar id={vote.userId} name={vote.name} size="sm" />
                <span className="min-w-0">
                  <span className="font-medium">{vote.name}</span>{" "}
                  <span
                    className={
                      vote.decision === "approve" ? "text-gate-approved-fg" : "text-gate-denied-fg"
                    }
                  >
                    {vote.decision === "approve" ? "approved" : "denied"}
                  </span>
                  {vote.reason && !(gate.status === "denied" && vote === denial) && (
                    <span className="text-muted-foreground">: {vote.reason}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {gate.status === "denied" && denial?.reason && (
          <p className="rounded-lg bg-gate-denied-bg px-3 py-2 text-sm text-gate-denied-fg">
            Sent to the agent as its next instruction: “{denial.reason}”
          </p>
        )}
        {outcome && <p className="text-xs text-muted-foreground">{outcome}</p>}

        {canAct && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="h-11 border-gate-denied/40 text-gate-denied-fg hover:bg-gate-denied-bg hover:text-gate-denied-fg"
              onClick={() => onDeny(gate)}
              disabled={busy}
            >
              <ThumbsDown aria-hidden />
              Deny…
            </Button>
            <Button
              className="h-11 bg-emerald-700 text-white hover:bg-emerald-700/90 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-500/90"
              onClick={approve}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ThumbsUp aria-hidden />}
              Approve
            </Button>
          </div>
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
