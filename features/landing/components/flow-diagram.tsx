"use client";

import {
  Laptop,
  MessagesSquare,
  Server,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Node = { id: string; icon: LucideIcon; title: string; detail: string };

const NODES: Node[] = [
  {
    id: "agent",
    icon: Terminal,
    title: "Claude Code",
    detail: "Your agent wants to run a command",
  },
  {
    id: "hook",
    icon: ShieldCheck,
    title: "Tollgate hook",
    detail: "On your machine: matches, redacts secrets",
  },
  {
    id: "server",
    icon: Server,
    title: "Tollgate",
    detail: "Team rules, quorum, risk signals, audit",
  },
  {
    id: "team",
    icon: MessagesSquare,
    title: "Team room",
    detail: "Live thread, push and calls on Nexconn",
  },
];

// Beams in the order a gate travels: out to the team, then the decision back to the agent.
const BEAMS: { from: string; to: string; tone: "out" | "back"; delay: number; bend: number }[] = [
  { from: "agent", to: "hook", tone: "out", delay: 0, bend: 0 },
  { from: "hook", to: "server", tone: "out", delay: 0.7, bend: 0 },
  { from: "server", to: "team", tone: "out", delay: 1.4, bend: 0 },
  { from: "team", to: "agent", tone: "back", delay: 2.4, bend: 1 },
];
const CYCLE = 4.2;

type Point = { x: number; y: number; w: number; h: number };

// The architecture as an animated diagram: a pulse runs along each connection in turn, amber
// on the way out, green when the decision comes back. Positions are measured from the DOM so
// the beams follow the layout at any width.
export function FlowDiagram() {
  const box = useRef<HTMLDivElement>(null);
  const nodes = useRef<Record<string, HTMLDivElement | null>>({});
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const inView = useInView(box, { once: true, margin: "-15%" });
  const reduced = useReducedMotion();

  const measure = () => {
    const root = box.current?.getBoundingClientRect();
    if (!root) return;
    const next: Record<string, Point> = {};
    for (const node of NODES) {
      const r = nodes.current[node.id]?.getBoundingClientRect();
      if (r)
        next[node.id] = {
          x: r.left - root.left + r.width / 2,
          y: r.top - root.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
    }
    setPoints(next);
    setSize({ w: root.width, h: root.height });
  };
  useLayoutEffect(measure, []);
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const vertical = size.w > 0 && size.w < 640;
  const path = (from: Point, to: Point, bend: number) => {
    if (!bend) return `M ${from.x},${from.y} L ${to.x},${to.y}`;
    // The way back arcs around the row (below it on wide screens, beside it on narrow ones).
    if (vertical) {
      const x = Math.max(from.x, to.x) + from.w / 2 + 36;
      return `M ${from.x + from.w / 2},${from.y} C ${x},${from.y} ${x},${to.y} ${to.x + to.w / 2},${to.y}`;
    }
    const y = Math.max(from.y, to.y) + from.h / 2 + 120;
    return `M ${from.x},${from.y + from.h / 2} C ${from.x},${y} ${to.x},${y} ${to.x},${to.y + to.h / 2}`;
  };

  return (
    <div ref={box} className="relative pb-24 max-sm:pe-10 sm:pb-40">
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          {(["out", "back"] as const).map((tone) => (
            <linearGradient key={tone} id={`beam-${tone}`} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={tone === "out" ? "#f2a900" : "#2eb67d"} stopOpacity="0" />
              <stop offset="0.5" stopColor={tone === "out" ? "#f2a900" : "#2eb67d"} />
              <stop offset="1" stopColor={tone === "out" ? "#ffd166" : "#7ff0be"} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {BEAMS.map((beam) => {
          const from = points[beam.from];
          const to = points[beam.to];
          if (!from || !to) return null;
          const d = path(from, to, beam.bend);
          return (
            <g key={`${beam.from}-${beam.to}`}>
              <path
                d={d}
                fill="none"
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth={2}
                strokeDasharray="4 6"
              />
              <motion.path
                d={d}
                fill="none"
                stroke={beam.tone === "out" ? "#f2a900" : "#2eb67d"}
                strokeWidth={2.5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.18 1"
                initial={{ strokeDashoffset: 0.18, opacity: 0 }}
                animate={
                  inView && !reduced
                    ? { strokeDashoffset: [0.18, -1], opacity: [0, 1, 1, 0] }
                    : { strokeDashoffset: -0.4, opacity: inView ? 1 : 0 }
                }
                transition={{
                  duration: 1.1,
                  delay: beam.delay,
                  repeat: reduced ? 0 : Infinity,
                  repeatDelay: CYCLE - 1.1,
                  ease: "easeInOut",
                }}
                style={{
                  filter: `drop-shadow(0 0 6px ${beam.tone === "out" ? "#f2a900" : "#2eb67d"})`,
                }}
              />
            </g>
          );
        })}
      </svg>

      <div className="relative grid gap-10 sm:grid-cols-4 sm:gap-6">
        {NODES.map((node, index) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.12, duration: 0.45 }}
            className="flex items-center gap-4 sm:flex-col sm:text-center"
          >
            <div
              ref={(element) => {
                nodes.current[node.id] = element;
              }}
              className={cn(
                "relative grid size-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-[#12171b] text-white shadow-[0_0_40px_-12px_rgb(46_182_125/0.5)]",
                node.id === "hook" &&
                  "border-[#f2a900]/40 shadow-[0_0_40px_-10px_rgb(242_169_0/0.6)]",
              )}
            >
              <node.icon className="size-7" />
              {node.id === "agent" && (
                <Laptop className="absolute -right-2 -bottom-2 size-5 rounded-md bg-[#12171b] p-0.5 text-white/60" />
              )}
            </div>
            <div>
              <p className="font-bold text-white">{node.title}</p>
              <p className="text-sm text-white/55">{node.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="absolute right-0 bottom-0 left-0 text-center text-sm text-white/55 max-sm:text-start">
        <span className="me-2 inline-block h-0.5 w-6 rounded bg-[#2eb67d] align-middle" />
        The decision goes back to the agent: approved runs, a deny reason becomes its next
        instruction.
      </p>
    </div>
  );
}
