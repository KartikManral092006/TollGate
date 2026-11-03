"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CommandStream as Stream } from "@/features/landing/components/command-stream-scene";

// The hero background: agent commands streaming through a gate (WebGL). Pauses off screen
// and in hidden tabs; one still frame for reduced motion; a plain glow without WebGL.
export function CommandStream({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion() ?? false;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) return;
    let cancelled = false;
    let stream: Stream | null = null;
    let onScreen = true;
    const sync = () => {
      if (onScreen && document.visibilityState === "visible") stream?.play();
      else stream?.pause();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    // The section, not the canvas, gets the pointer (the canvas sits behind the content).
    const host = canvas.closest("section") ?? window;
    const onPointer = (event: Event) => {
      const e = event as PointerEvent;
      stream?.point(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * -2 + 1,
      );
    };
    host.addEventListener("pointermove", onPointer);

    import("@/features/landing/components/command-stream-scene")
      .then(({ createCommandStream }) => {
        if (cancelled) return;
        stream = createCommandStream(canvas, {
          reduced,
          density: window.innerWidth < 640 ? 0.45 : 1,
        });
        setReady(true);
        sync();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onPointer);
      stream?.dispose();
    };
  }, [reduced]);

  return (
    <div aria-hidden className={className}>
      {/* Behind the stream (and in its place without WebGL): a soft glow at the gate. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_45%,rgb(242_169_0/0.10),transparent_70%),radial-gradient(50%_60%_at_20%_60%,rgb(46_182_125/0.10),transparent_70%)]" />
      <motion.canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 1.2 }}
      />
    </div>
  );
}
