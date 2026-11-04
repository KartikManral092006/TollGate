"use client";

import { useEffect, useRef, useState } from "react";
import type { GateStream as Stream } from "@/features/landing/components/gate-stream-scene";
import { cn } from "@/lib/utils";

// The hero's background (see gate-stream-scene.ts). Pauses off screen and in hidden tabs,
// runs lighter on phones and low-core devices, and draws one still frame for reduced motion.
export function GateStream({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const light = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;
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
    const host = canvas.closest("section") ?? window;
    const onPointer = (event: Event) => {
      const e = event as PointerEvent;
      stream?.point(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    };
    host.addEventListener("pointermove", onPointer);

    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-overpass-mono").trim() ||
      "ui-monospace";
    Promise.all([
      import("@/features/landing/components/gate-stream-scene"),
      document.fonts.load(`500 13px ${family}`).catch(() => undefined),
    ])
      .then(([{ createGateStream }]) => {
        if (cancelled) return;
        stream = createGateStream(canvas, { reduced, light, fontFamily: family });
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
  }, []);

  return (
    <div aria-hidden className={className}>
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-1000",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
