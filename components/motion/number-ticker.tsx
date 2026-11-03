"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

// Counts up to a value once it scrolls into view. Writes straight to the DOM (no re-render per
// frame). Reduced motion shows the final value at once.
export function NumberTicker({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced || !inView) {
      node.textContent = format(reduced ? value : 0);
      if (reduced) return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => {
        node.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [value, inView, reduced, format]);

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {format(value)}
    </span>
  );
}
