"use client";

import { ArrowRight, Check, History, PauseCircle, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { NumberTicker } from "@/components/motion/number-ticker";
import { cn } from "@/lib/utils";

// A clock for one tile's loop, ticking only while the tile is on screen. Reduced motion
// freezes it at `still`, the frame that tells the story.
function useLoop(ref: React.RefObject<HTMLElement | null>, period: number, still: number) {
  const reduced = useReducedMotion() ?? false;
  const inView = useInView(ref, { margin: "-10%" });
  const [t, setT] = useState(still);
  useEffect(() => {
    if (reduced || !inView) return;
    const start = performance.now();
    const timer = setInterval(() => setT((performance.now() - start) % period), 60);
    return () => clearInterval(timer);
  }, [reduced, inView, period]);
  return reduced ? still : t;
}

function Tile({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SpotlightCard className={cn("flex flex-col", className)}>
      <div className="flex h-full flex-col">
        <div className="relative flex min-h-44 flex-1 items-center justify-center overflow-hidden border-b border-white/10 p-5">
          {children}
        </div>
        <div className="p-5">
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
        </div>
      </div>
    </SpotlightCard>
  );
}

const pop = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};

function SeeThrough() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 6000, 5000);
  return (
    <div ref={ref} className="flex w-full max-w-md flex-col gap-3 font-mono text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-white">
          pnpm db:deploy
        </span>
        <AnimatePresence>
          {t > 900 && (
            <motion.span key="runs" {...pop} className="flex items-center gap-3">
              <ArrowRight className="size-4 text-white/40" />
              <span className="rounded-lg border border-[#f2a900]/40 bg-[#f2a900]/10 px-3 py-1.5 text-[#f2c14e]">
                prisma migrate deploy
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="min-h-16 rounded-lg bg-black/30 p-3 text-xs leading-relaxed">
        <AnimatePresence>
          {t > 2000 && (
            <motion.p key="file" {...pop} className="text-white/50">
              -- 20261104_drop_legacy_total
            </motion.p>
          )}
          {t > 2600 && (
            <motion.p
              key="drop"
              {...pop}
              className="-mx-3 flex items-center justify-between gap-2 bg-[#e5485d]/15 px-3 text-[#ff8796]"
            >
              <span>ALTER TABLE invoices DROP COLUMN legacy_total;</span>
              <TriangleAlert className="size-3.5 shrink-0" />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const SECRET = "hunter2-s3cret";
const GLYPHS = "!<>-_\\/[]{}=+*^?#ABCDEF0123456789";

function Redact() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 4200, 3000);
  // 0-1.2 s the secret is plain; 1.2-2 s it scrambles; then it reads [REDACTED].
  const phase = t < 1200 ? "plain" : t < 2000 ? "scramble" : "done";
  const shown =
    phase === "plain"
      ? SECRET
      : phase === "scramble"
        ? Array.from(SECRET, (_, i) => GLYPHS[(i * 7 + Math.floor(t / 60)) % GLYPHS.length]).join(
            "",
          )
        : "[REDACTED]";
  return (
    <div ref={ref} className="w-full max-w-xs font-mono text-xs leading-relaxed">
      <p className="text-white/45">DATABASE_URL=</p>
      <p className="break-all text-white">
        postgres://deploy:
        <span
          className={cn(
            "rounded px-0.5 transition-colors",
            phase === "plain" && "bg-[#e5485d]/25 text-[#ff8796]",
            phase === "scramble" && "text-[#f2c14e]",
            phase === "done" && "bg-[#2eb67d]/20 text-[#4fd199]",
          )}
        >
          {shown}
        </span>
        @db.prod:5432
      </p>
      <p
        className={cn(
          "mt-3 flex items-center gap-1.5 text-[#4fd199] transition-opacity",
          phase === "done" ? "opacity-100" : "opacity-0",
        )}
      >
        <Check className="size-3.5" /> Hidden before it left the laptop
      </p>
    </div>
  );
}

const REPLY = "Understood. Renaming legacy_total and backing up first.";

function DenyReason() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 6500, 6000);
  const typed = Math.max(0, Math.min(REPLY.length, Math.floor((t - 1800) / 35)));
  return (
    <div ref={ref} className="flex w-full max-w-xs flex-col gap-3 text-sm">
      <AnimatePresence>
        {t > 300 && (
          <motion.div
            key="reason"
            {...pop}
            className="self-start rounded-2xl rounded-bl-sm bg-[#e5485d]/15 px-3 py-2 text-[#ffc2ca]"
          >
            <span className="block text-[11px] font-semibold text-[#ff8796]">Ana denied TG-17</span>
            Rename it, don&apos;t drop it. Finance still reads it.
          </motion.div>
        )}
      </AnimatePresence>
      {t > 1800 && (
        <p className="self-end rounded-2xl rounded-br-sm bg-white/5 px-3 py-2 font-mono text-xs text-white/85">
          {REPLY.slice(0, typed)}
          {typed < REPLY.length && <span className="animate-pulse">▍</span>}
        </p>
      )}
    </div>
  );
}

function Parks() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 8000, 6500);
  const left = Math.max(0, 5 - Math.floor(t / 600));
  const stage = t < 3000 ? "waiting" : t < 5200 ? "parked" : "approved";
  const fraction = Math.max(0, 1 - t / 3000);
  const c = 2 * Math.PI * 22;
  return (
    <div ref={ref} className="flex flex-col items-center gap-3 text-center">
      <div className="relative grid size-20 place-items-center">
        <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke={stage === "approved" ? "#2eb67d" : stage === "parked" ? "#8a9096" : "#f2a900"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={stage === "approved" ? 0 : c * (1 - fraction)}
            className="transition-[stroke-dashoffset,stroke] duration-500"
          />
        </svg>
        <AnimatePresence mode="wait">
          <motion.span
            key={stage === "waiting" ? left : stage}
            {...pop}
            className="font-mono text-lg font-bold text-white"
          >
            {stage === "waiting" ? (
              `0:0${left}`
            ) : stage === "parked" ? (
              <PauseCircle className="size-6 text-white/60" />
            ) : (
              <Check className="size-6 text-[#4fd199]" />
            )}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="h-10 max-w-48 text-xs text-white/60">
        {stage === "waiting"
          ? "Nobody has answered yet…"
          : stage === "parked"
            ? "Parked. The agent moved on to other work."
            : "Approved at 09:05. The retry passes, once."}
      </p>
    </div>
  );
}

const SIGNALS = [
  { text: "Drops a column and every value in it", tone: "text-[#ff8796]" },
  { text: "The agent says staging, the command says production", tone: "text-[#ff8796]" },
  { text: "Production from branch feat/minor-units", tone: "text-[#f2c14e]" },
];

function Signals() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 6000, 5000);
  return (
    <div ref={ref} className="flex w-full max-w-xs flex-col gap-2 text-sm">
      {SIGNALS.map((signal, index) => (
        <motion.p
          key={signal.text}
          animate={{
            opacity: t > 400 + index * 700 ? 1 : 0,
            x: t > 400 + index * 700 ? 0 : -8,
          }}
          className={cn("flex items-start gap-2 font-medium", signal.tone)}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {signal.text}
        </motion.p>
      ))}
      <motion.p
        animate={{ opacity: t > 2800 ? 1 : 0 }}
        className="mt-1 flex items-start gap-2 border-s-2 border-[#e5485d] ps-2 text-xs text-white/60"
      >
        <History className="mt-px size-3.5 shrink-0" /> TG-15 was denied by Ana yesterday: “Back up
        first.”
      </motion.p>
    </div>
  );
}

const QUEUE = [
  "TG-16 vercel --prod",
  "TG-17 prisma migrate deploy",
  "TG-19 fly deploy",
  "TG-21 npm publish",
];
const KEYS = ["J", "J", "A", "J", "D"];

function Review() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 5000, 2100);
  const press = Math.floor(t / 1000) % KEYS.length;
  const cursor = Math.min(
    QUEUE.length - 1,
    KEYS.slice(0, press + 1).filter((key) => key === "J").length,
  );
  return (
    <div ref={ref} className="grid w-full max-w-lg items-center gap-6 sm:grid-cols-[1fr_auto]">
      <ul className="flex flex-col gap-1.5 font-mono text-xs">
        {QUEUE.map((item, index) => (
          <li
            key={item}
            className={cn(
              "relative rounded-md px-3 py-1.5 transition-colors duration-300",
              index === cursor ? "bg-white/10 text-white" : "text-white/40",
            )}
          >
            {index === cursor && (
              <motion.span
                layoutId="bento-review"
                className="absolute inset-y-1 start-0 w-0.5 rounded bg-[#2eb67d]"
              />
            )}
            {item}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {["J", "K", "A", "D"].map((key) => (
          <motion.kbd
            key={key}
            animate={{ y: KEYS[press] === key ? 2 : 0 }}
            className={cn(
              "grid size-10 place-items-center rounded-lg border border-white/15 bg-white/5 font-mono text-sm text-white shadow-[0_3px_0_rgb(255_255_255/0.12)] transition-colors",
              KEYS[press] === key &&
                (key === "A" ? "bg-[#2eb67d]/30" : key === "D" ? "bg-[#e5485d]/30" : "bg-white/15"),
            )}
          >
            {key}
          </motion.kbd>
        ))}
      </div>
    </div>
  );
}

function Record() {
  const count = (n: number) => String(Math.round(n));
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-4 text-center">
      {[
        { value: 148, label: "gates" },
        { value: 41, label: "s median" },
        { value: 12, label: "% denied" },
      ].map((stat) => (
        <div key={stat.label}>
          <p className="text-3xl font-extrabold text-white tabular-nums">
            <NumberTicker value={stat.value} format={count} />
          </p>
          <p className="text-xs text-white/50">{stat.label}</p>
        </div>
      ))}
      <p className="col-span-3 text-[11px] text-white/35">Example numbers</p>
    </div>
  );
}

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Tile
        className="lg:col-span-2"
        title="Sees what a command really runs"
        body="Package scripts, wrappers and piped installers are opened up before matching, so pnpm db:deploy is caught as the migration it is, with the SQL that destroys data marked."
      >
        <SeeThrough />
      </Tile>
      <Tile
        title="Secrets stay on your machine"
        body="Tokens, passwords and .env values are redacted by the hook before anything is sent, then checked again on the server."
      >
        <Redact />
      </Tile>
      <Tile
        title="Deny with a reason, the agent replans"
        body="Your reason reaches the agent word for word as its next instruction. Or ask it a question first."
      >
        <DenyReason />
      </Tile>
      <Tile
        title="Nobody awake? It parks"
        body="Before the hook times out, the gate parks and the agent moves on. Approve it later and the same command passes once."
      >
        <Parks />
      </Tile>
      <Tile
        title="Risk you can see before you vote"
        body="Plain-language warnings from the SQL and the command, and what your team decided last time."
      >
        <Signals />
      </Tile>
      <Tile
        className="lg:col-span-2"
        title="A review queue you can clear from the keyboard"
        body="Waiting gates one at a time, oldest first, with the explanation already open. J and K to move, A to approve, D to deny."
      >
        <Review />
      </Tile>
      <Tile
        title="Every decision on record"
        body="Who approved what, why and how fast, with trends and a CSV export for the post-mortem."
      >
        <Record />
      </Tile>
    </div>
  );
}
