"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

// A short burst of signal-coloured confetti for real milestones (setup finished). Purely
// decorative: hidden from screen readers, skipped entirely with reduced motion.
const COLORS = ["#00704a", "#f2a900", "#c8102e", "#2eb67d", "#ffffff"];

export function Celebrate({ fire, onDone }: { fire: boolean; onDone?: () => void }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: (Math.cos((i / 28) * Math.PI * 2) * (90 + (i % 5) * 28)) | 0,
        y: (Math.sin((i / 28) * Math.PI * 2) * (70 + (i % 4) * 26) - 60) | 0,
        rotate: (i * 47) % 360,
        color: COLORS[i % COLORS.length]!,
        wide: i % 3 === 0,
      })),
    [],
  );

  useEffect(() => {
    if (!fire || reduced) return;
    const start = setTimeout(() => setActive(true), 0);
    const stop = setTimeout(() => {
      setActive(false);
      onDone?.();
    }, 1400);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [fire, reduced, onDone]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible"
    >
      <AnimatePresence>
        {active &&
          pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute block rounded-[2px]"
              style={{ background: p.color, width: p.wide ? 10 : 6, height: p.wide ? 4 : 8 }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
              animate={{
                x: p.x,
                y: [0, p.y, p.y + 140],
                opacity: [1, 1, 0],
                rotate: p.rotate + 360,
                scale: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: [0.2, 0.8, 0.3, 1], times: [0, 0.45, 1] }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}
