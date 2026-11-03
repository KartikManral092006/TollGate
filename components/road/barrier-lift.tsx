"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Lift = { play(): void; dispose(): void };

// A 3D barrier that lifts once (Three.js, loaded on demand) and again on hover. `fallback` is
// shown until it loads, and for good where WebGL isn't available.
export function BarrierLift({
  className,
  fallback,
}: {
  className?: string;
  fallback: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liftRef = useRef<Lift | null>(null);
  const reduced = useReducedMotion() ?? false;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) return;
    import("@/components/road/barrier-lift-scene")
      .then(({ createBarrierLift }) => {
        if (cancelled) return;
        liftRef.current = createBarrierLift(canvas, { reduced });
        setReady(true);
        liftRef.current.play();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      liftRef.current?.dispose();
      liftRef.current = null;
    };
  }, [reduced]);

  return (
    <div
      aria-hidden
      className={cn("relative shrink-0", className)}
      onPointerEnter={() => liftRef.current?.play()}
    >
      <canvas ref={canvasRef} className={cn("absolute inset-0 size-full", !ready && "invisible")} />
      {!ready && fallback}
    </div>
  );
}
