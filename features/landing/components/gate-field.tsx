"use client";

import { useEffect, useRef, useState } from "react";
import type { GateField as Field } from "@/features/landing/components/gate-field-scene";
import { ScrollTrigger } from "@/features/landing/motion/gsap";
import { cn } from "@/lib/utils";

// The hero's WebGL scene (see gate-field-scene.ts). Pauses off screen and in hidden tabs, runs
// lighter on phones, draws one still frame for reduced motion, and shows a plain glow where
// WebGL isn't available. Scrolling through the section it fills flies the camera through the gate.
export function GateField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const light = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;
    let cancelled = false;
    let field: Field | null = null;
    let onScreen = true;
    const sync = () => {
      if (onScreen && document.visibilityState === "visible") field?.play();
      else field?.pause();
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
      field?.point(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * -2 + 1,
      );
    };
    host.addEventListener("pointermove", onPointer);
    const trigger = ScrollTrigger.create({
      trigger: canvas.closest("section") ?? canvas,
      // Ends when the sticky stage lets go (the section's bottom reaches the screen's).
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => field?.scrollTo(self.progress),
    });

    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-overpass-mono").trim() ||
      "ui-monospace";
    Promise.all([
      import("@/features/landing/components/gate-field-scene"),
      document.fonts.load(`600 34px ${family}`).catch(() => undefined),
    ])
      .then(([{ createGateField }]) => {
        if (cancelled) return;
        field = createGateField(canvas, { reduced, light, fontFamily: family });
        field.scrollTo(trigger.progress);
        setReady(true);
        sync();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      intersection.disconnect();
      trigger.kill();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onPointer);
      field?.dispose();
    };
  }, []);

  return (
    <div aria-hidden className={className}>
      <div className="absolute inset-0 bg-[#0b0f12] bg-[radial-gradient(45%_55%_at_72%_50%,rgb(242_169_0/0.16),transparent_70%)]" />
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-[1500ms]",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
