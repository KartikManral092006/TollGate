"use client";

import { motion } from "motion/react";
import { BarrierLift } from "@/components/road/barrier-lift";
import { cn } from "@/lib/utils";

// Nothing waiting: the barrier lifts and the light turns green. Plays once; reduced motion
// shows it already raised.
export function AllClear({
  title = "All clear",
  description = "Nothing is waiting for a decision.",
  className,
  large = false,
}: {
  title?: string;
  description?: string;
  className?: string;
  // The big version for a whole empty page (review queue).
  large?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <BarrierLift
        className={large ? "size-28" : "size-16"}
        fallback={
          <div aria-hidden className="relative h-14 w-14 shrink-0">
            <span className="absolute bottom-0 left-1 h-9 w-2.5 rounded-t-sm bg-muted-foreground/35" />
            <motion.span
              className="absolute top-[1.45rem] left-[0.55rem] size-1.5 rounded-full bg-gate-approved"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            />
            <motion.span
              className="absolute top-8 left-2 h-2 w-11 origin-left rounded-full bg-[repeating-linear-gradient(-45deg,#c8102e_0_6px,#ffffff_6px_12px)] ring-1 ring-black/10"
              initial={{ rotate: 0 }}
              animate={{ rotate: -48 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.3, 0, 0.2, 1] }}
            />
          </div>
        }
      />
      <div>
        <p className={cn("font-semibold", large ? "text-xl" : "text-sm")}>{title}</p>
        <p className={cn("text-muted-foreground", large ? "text-base" : "text-sm")}>
          {description}
        </p>
      </div>
    </div>
  );
}
