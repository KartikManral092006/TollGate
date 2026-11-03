"use client";

import { Check, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/fx/border-beam";
import { cn } from "@/lib/utils";

type Line = { text: string; tone: "you" | "agent" | "tool" | "gate" | "risk" | "ok" | "dim" };

const PROMPT = "ship the billing migration to production";

// The session, step by step: what appears and when (ms after the prompt is typed).
const SCRIPT: { at: number; line: Line }[] = [
  { at: 300, line: { tone: "agent", text: "I'll apply the pending Prisma migration." } },
  { at: 1100, line: { tone: "tool", text: "● Bash(npx prisma migrate deploy)" } },
  { at: 1700, line: { tone: "gate", text: "  ⏸ Tollgate: waiting on your team · TG-17 (0/2)" } },
  { at: 2200, line: { tone: "risk", text: "    ↳ drops invoices.legacy_total and its data" } },
  { at: 4200, line: { tone: "ok", text: "  ✓ Ana approved · 1/2" } },
  { at: 5100, line: { tone: "ok", text: "  ✓ Raj approved · 2/2" } },
  { at: 5800, line: { tone: "dim", text: "  Applying migration… 1 applied" } },
  { at: 6600, line: { tone: "agent", text: "Done. Production is on the new schema." } },
];
const LOOP_MS = 9800;
const TYPE_MS = 38;

const TONE: Record<Line["tone"], string> = {
  you: "text-white",
  agent: "text-white/85",
  tool: "text-sky-300",
  gate: "text-[#f2a900]",
  risk: "text-[#ff8796]",
  ok: "text-[#4fd199]",
  dim: "text-white/45",
};

// One loop of the session, driven by a single clock so the terminal and the phone agree.
function useSession(enabled: boolean) {
  const [t, setT] = useState(enabled ? 0 : 4600);
  useEffect(() => {
    if (!enabled) return;
    // 20 updates a second is plenty for text that changes a few times a second.
    const start = performance.now();
    const timer = setInterval(() => setT((performance.now() - start) % LOOP_MS), 50);
    return () => clearInterval(timer);
  }, [enabled]);
  return t;
}

export function AgentTerminal() {
  const reduced = useReducedMotion() ?? false;
  const t = useSession(!reduced);
  const typed = Math.min(PROMPT.length, Math.floor(t / TYPE_MS));
  const after = t - PROMPT.length * TYPE_MS;
  const lines = after < 0 ? [] : SCRIPT.filter((step) => step.at <= after);
  const waiting = after >= 1700 && after < 5100;
  const approvals = after >= 5100 ? 2 : after >= 4200 ? 1 : 0;
  const showPhone = after >= 1900 && after < 6200;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-xl select-none">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1215]/90 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] backdrop-blur">
        <BorderBeam radius={16} duration={7} />
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ms-3 font-mono text-xs text-white/45">claude · ~/acme/billing</span>
          <span className="ms-auto flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/50">
            <ShieldAlert className="size-3 text-[#f2a900]" /> tollgate hook
          </span>
        </div>
        <div className="h-72 space-y-1 px-4 py-4 font-mono text-[13px] leading-relaxed sm:h-80">
          <p className="text-white">
            <span className="text-[#2eb67d]">&gt; </span>
            {PROMPT.slice(0, typed)}
            {typed < PROMPT.length && <span className="animate-pulse">▍</span>}
          </p>
          <AnimatePresence initial={false}>
            {lines.map(({ line }) => (
              <motion.p
                key={line.text}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className={cn("whitespace-pre-wrap", TONE[line.tone])}
              >
                {line.text}
                {line.tone === "gate" && waiting && (
                  <span className="ms-2 inline-block size-2 animate-pulse rounded-full bg-[#f2a900] align-middle shadow-[0_0_10px_#f2a900]" />
                )}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* The same gate on a teammate's phone. */}
      <AnimatePresence>
        {(showPhone || reduced) && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="absolute -right-2 -bottom-10 w-64 rounded-2xl border border-white/15 bg-[#151a1e]/95 p-3.5 text-white shadow-2xl backdrop-blur sm:-right-8"
          >
            <p className="flex items-center gap-2 text-[11px] text-white/50">
              <span className="grid size-4 place-items-center rounded bg-[#2eb67d] text-[9px] font-black text-[#06140d]">
                T
              </span>
              Tollgate · now
            </p>
            <p className="mt-1.5 text-sm font-semibold">
              <span className="font-mono">TG-17</span>{" "}
              <span className="rounded bg-[#e5485d] px-1 text-[10px] font-bold">PROD</span> needs
              your decision
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-white/60">
              npx prisma migrate deploy
            </p>
            <div className="mt-2.5 flex items-center gap-1">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "size-2 rounded-full transition-colors duration-300",
                    i < approvals ? "bg-[#2eb67d]" : "bg-white/20",
                  )}
                />
              ))}
              <span className="ms-1 text-[11px] text-white/50">{approvals}/2 approved</span>
              {approvals === 2 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ms-auto grid size-5 place-items-center rounded-full bg-[#2eb67d] text-[#06140d]"
                >
                  <Check className="size-3.5" />
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
