"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const HOLD_MS = 1000;

// A button that acts only after being held for a second, like a barrier arm lifting. For
// decisions where a quick tap is too easy: releasing early cancels. Works with a pointer and
// with Space or Enter held down. The fill still runs with reduced motion: it's the feedback.
export function HoldButton({
  onHold,
  children,
  className,
  disabled,
  label,
}: {
  onHold: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onHold();
    }, HOLD_MS);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn("relative touch-none overflow-hidden select-none", className)}
      onPointerDown={(event) => {
        if (event.button === 0) start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") cancel();
      }}
      // A tap or click alone never acts.
      onClick={(event) => event.preventDefault()}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 start-0 bg-white/30",
          holding ? "w-full transition-[width] ease-linear" : "w-0 transition-[width] duration-150",
        )}
        style={holding ? { transitionDuration: `${HOLD_MS}ms` } : undefined}
      />
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </Button>
  );
}
