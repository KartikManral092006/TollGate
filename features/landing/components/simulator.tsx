"use client";

import { Play, RotateCcw, TimerReset } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GateView } from "@/features/gates/shared/view";
import { riskSignals } from "@/features/insights/shared/signals";
import type { Precedent } from "@/features/insights/shared/types";
import { DenyDrawer } from "@/features/room/components/deny-drawer";
import { GateCard } from "@/features/room/components/gate-card";
import { cn } from "@/lib/utils";

// A scripted, browser-only run of the core loop for visitors and judges: the visitor is the
// approver, the "agent" reacts to their decision. No account, no server, no Nexconn user.

type Line = { id: number; text: string; tone?: "dim" | "ok" | "bad" | "warn" | "agent" | "cmd" };

const MIGRATION = `ALTER TABLE "invoices" DROP COLUMN "legacy_total";`;

function gate(
  code: number,
  patch: Partial<GateView> = {},
  precedent: Precedent | null = null,
): GateView {
  const now = new Date().toISOString();
  const view: GateView = {
    id: `demo-${code}`,
    code,
    status: "pending",
    preset: "db-migrate",
    env: "staging",
    repo: "acme/billing",
    mode: "guard",
    branch: "feat/minor-units",
    command:
      "DATABASE_URL=postgres://deploy:[REDACTED]@db.staging:5432/billing npx prisma migrate deploy",
    context: `Newest migration 20261102_drop_legacy_total:\n${MIGRATION}`,
    intent: "Apply the pending migration so the minor-units change works on staging",
    redactions: 1,
    quorum: 1,
    approvals: 0,
    requester: { id: "demo-kartik", name: "Kartik" },
    votes: [],
    denyReason: null,
    question: null,
    followUp: null,
    answeredIn: null,
    rule: null,
    decidedAt: null,
    parkedAt: null,
    grant: null,
    calls: [],
    createdAt: now,
    ...patch,
  };
  // The same rules the room uses, so the demo shows real signals for its migration.
  return { ...view, insights: { precedent, signals: riskSignals(view, []), approvers: [] } };
}

const TONE: Record<NonNullable<Line["tone"]>, string> = {
  dim: "text-white/50",
  ok: "text-[#4fd199]",
  bad: "text-[#ff8796]",
  warn: "text-amber-300",
  agent: "text-white",
  cmd: "text-sky-300",
};

export function Simulator() {
  const [lines, setLines] = useState<Line[]>([]);
  const [cards, setCards] = useState<GateView[]>([]);
  const [denying, setDenying] = useState<GateView | null>(null);
  const [asking, setAsking] = useState<GateView | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);

  const say = useCallback((text: string, tone?: Line["tone"], delay = 0) => {
    timers.current.push(
      setTimeout(
        () => setLines((current) => [...current, { id: nextId.current++, text, tone }]),
        delay,
      ),
    );
  }, []);

  const later = useCallback((delay: number, work: () => void) => {
    timers.current.push(setTimeout(work, delay));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);
  // Keep the newest card in view inside the room pane (never scrolls the page itself).
  useEffect(() => {
    const pane = roomRef.current;
    if (!pane) return;
    const timer = setTimeout(
      () => pane.scrollTo({ top: pane.scrollHeight, behavior: "smooth" }),
      350,
    );
    return () => clearTimeout(timer);
  }, [cards.length]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);
    setCards([]);
    setDenying(null);
    setAsking(null);
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    reset();
    setRunning(true);
    say("> apply the billing migration to staging", "agent");
    say("I'll deploy the pending Prisma migration to the staging database.", "dim", 700);
    say("● Bash(npx prisma migrate deploy)", "cmd", 1500);
    say("  ⏸  Tollgate: waiting on your team · TG-17 (0/1)", "warn", 2100);
    later(2300, () => setCards([gate(17)]));
  }, [later, reset, say]);

  const finish = useCallback(
    (code: number) => {
      say(`  ✓ Approved by You in TG-${code}`, "ok");
      say("  Applying migration… done (1 migration applied)", "dim", 700);
      say("All set. Staging is on the new schema.", "agent", 1400);
      later(1500, () => setRunning(false));
    },
    [later, say],
  );

  const approve = useCallback(
    async (target: GateView) => {
      setCards((current) =>
        current.map((g) =>
          g.id === target.id
            ? {
                ...g,
                status: "approved",
                approvals: 1,
                decidedAt: new Date().toISOString(),
                votes: [
                  {
                    userId: "demo-you",
                    name: "You",
                    decision: "approve",
                    reason: null,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : g,
        ),
      );
      finish(target.code);
    },
    [finish],
  );

  const deny = useCallback(
    async (target: GateView, reason: string) => {
      setCards((current) =>
        current.map((g) =>
          g.id === target.id
            ? {
                ...g,
                status: "denied",
                denyReason: reason,
                decidedAt: new Date().toISOString(),
                votes: [
                  {
                    userId: "demo-you",
                    name: "You",
                    decision: "deny",
                    reason,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : g,
        ),
      );
      say(`  ✗ Denied by You in TG-${target.code}: ${reason}`, "bad");
      say("Understood. I'll follow that instead of dropping the column:", "agent", 900);
      say("  1. Back up invoices  2. Rename legacy_total → legacy_total_archived", "dim", 1500);
      say("● Bash(npx prisma migrate deploy)  # revised migration", "cmd", 2300);
      say(`  ⏸  Tollgate: waiting on your team · TG-${target.code + 1} (0/1)`, "warn", 2900);
      later(3100, () =>
        setCards((current) => [
          ...current,
          gate(
            target.code + 1,
            {
              context: `Newest migration 20261103_archive_legacy_total:\nCREATE TABLE invoices_backup AS TABLE invoices;\nALTER TABLE "invoices" RENAME COLUMN "legacy_total" TO "legacy_total_archived";`,
            },
            {
              gateId: target.id,
              code: target.code,
              status: "denied",
              by: ["You"],
              reason,
              decidedAt: new Date().toISOString(),
              match: "same",
              repo: target.repo,
              sameRepo: true,
              tally: { approved: 0, denied: 1 },
            },
          ),
        ]),
      );
      return true;
    },
    [later, say],
  );

  const ask = useCallback(
    async (target: GateView, question: string) => {
      setCards((current) =>
        current.map((g) =>
          g.id === target.id
            ? {
                ...g,
                status: "denied",
                question,
                denyReason: question,
                decidedAt: new Date().toISOString(),
                votes: [
                  {
                    userId: "demo-you",
                    name: "You",
                    decision: "deny",
                    reason: question,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : g,
        ),
      );
      say(`  ? You asked in TG-${target.code}: ${question}`, "warn");
      say("Fair question. Answering it and asking again:", "agent", 900);
      say("● Bash(npx prisma migrate deploy)", "cmd", 1700);
      say(`  ⏸  Tollgate: waiting on your team · TG-${target.code + 1} (0/1)`, "warn", 2300);
      later(2500, () =>
        setCards((current) => [
          ...current.map((g) => (g.id === target.id ? { ...g, answeredIn: target.code + 1 } : g)),
          gate(target.code + 1, {
            followUp: { code: target.code, question, askedBy: "You" },
            intent:
              "It drops invoices.legacy_total on staging, about 48,000 values. Nothing reads it since the minor-units change. There's no backup yet; I can take one first.",
          }),
        ]),
      );
      return true;
    },
    [later, say],
  );

  const timeOut = useCallback(() => {
    const open = cards.find((g) => g.status === "pending");
    if (!open) return;
    setCards((current) =>
      current.map((g) =>
        g.id === open.id ? { ...g, status: "parked", parkedAt: new Date().toISOString() } : g,
      ),
    );
    say(`  ⏸  Parked as TG-${open.code}: nobody decided in time.`, "warn");
    say("No problem, I'll work on the invoice PDF in the meantime and retry later.", "agent", 900);
    say(
      "(Approve the parked card now: the agent's retry will pass straight through.)",
      "dim",
      1600,
    );
  }, [cards, say]);

  const pending = cards.some((g) => g.status === "pending");

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      <div className="flex min-h-80 flex-col overflow-hidden rounded-2xl bg-asphalt shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-[#2eb67d]/80" />
          <span className="ms-2 font-mono text-xs text-white/50">claude · ~/acme/billing</span>
        </div>
        <div
          ref={termRef}
          className="h-80 flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed lg:h-[26rem]"
          aria-live="polite"
        >
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-xs font-sans text-sm text-white/70">
                Play the teammate. A coding agent is about to change a shared database, and it has
                to ask you first.
              </p>
              <Button
                onClick={start}
                size="lg"
                className="h-11 bg-signal font-sans text-base text-signal-foreground hover:bg-signal/90"
              >
                <Play /> Run the agent
              </Button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <motion.p
                  key={line.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("break-words whitespace-pre-wrap", line.tone && TONE[line.tone])}
                >
                  {line.text}
                </motion.p>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Team room{" "}
            <span className="font-normal text-muted-foreground">· you are the approver</span>
          </p>
          <div className="flex gap-1">
            {pending && (
              <Button size="sm" variant="ghost" onClick={timeOut}>
                <TimerReset /> Let it time out
              </Button>
            )}
            {(cards.length > 0 || running) && (
              <Button size="sm" variant="ghost" onClick={reset} aria-label="Start over">
                <RotateCcw />
              </Button>
            )}
          </div>
        </div>
        <div
          ref={roomRef}
          className="relative flex flex-col gap-3 lg:max-h-[34rem] lg:overflow-y-auto"
        >
          {cards.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Gate cards show up here.
            </div>
          ) : (
            cards.map((card) => (
              <GateCard
                key={card.id}
                gate={card}
                viewer={{ id: "demo-you", canVote: true }}
                onApprove={approve}
                onDeny={setDenying}
                onAsk={setAsking}
                onWhy={async (target) => {
                  await new Promise((done) => setTimeout(done, 700));
                  const text = target.context.includes("DROP COLUMN")
                    ? "This applies a database migration to the shared staging database. The migration deletes the legacy_total column from invoices, along with every value stored in it. Anything that still reads that column (reports, exports, other services) will break, and the data can't be recovered unless a backup exists. Staging is shared, so teammates are affected too."
                    : "This applies the revised migration: it first copies the invoices table to invoices_backup, then renames legacy_total to legacy_total_archived instead of deleting it. No data is removed and the rename can be reversed, though code still reading the old column name will need updating.";
                  return { text, source: "ai", model: null, fallback: false };
                }}
              />
            ))
          )}
        </div>
      </div>

      <DenyDrawer gate={denying} onClose={() => setDenying(null)} onSubmit={deny} />
      <DenyDrawer gate={asking} mode="ask" onClose={() => setAsking(null)} onSubmit={ask} />
    </div>
  );
}
