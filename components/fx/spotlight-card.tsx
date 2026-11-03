"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// A tile whose surface lights up under the cursor, with a faint glow along its border.
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const box = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
        ref.current!.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      }}
      className={cn(
        "group/spot relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(46 182 125 / 0.12), transparent 60%)",
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
