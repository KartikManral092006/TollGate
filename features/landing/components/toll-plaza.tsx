"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BarrierHero } from "@/features/landing/components/barrier-hero";
import type {
  PlazaPhase,
  TollPlaza as Plaza,
} from "@/features/landing/components/toll-plaza-scene";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const STATUS: Record<PlazaPhase, { text: string; tone: string }> = {
  approach: { text: "❯ npx prisma migrate deploy", tone: "text-white" },
  blocked: { text: "Waiting on your team · TG-17", tone: "text-signal" },
  approved: { text: "Ana approved TG-17", tone: "text-[#4fd199]" },
  pass: { text: "1 migration applied. Done.", tone: "text-white/75" },
};

// The hero: a 3D toll plaza (Three.js, loaded after the page) with the terminal's view on
// top. Falls back to the flat barrier animation where WebGL isn't available.
export function TollPlaza() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plazaRef = useRef<Plaza | null>(null);
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<PlazaPhase>("approach");
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!webglAvailable()) {
      const timer = setTimeout(() => setFallback(true), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    let visible = true;
    let onScreen = true;
    const sync = () => {
      if (visible && onScreen) plazaRef.current?.play();
      else plazaRef.current?.pause();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    intersection.observe(canvas);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    import("@/features/landing/components/toll-plaza-scene")
      .then(({ createTollPlaza }) => {
        if (cancelled) return;
        plazaRef.current = createTollPlaza(canvas, { reduced, onPhase: setPhase });
        setReady(true);
        sync();
      })
      .catch(() => setFallback(true));

    return () => {
      cancelled = true;
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      plazaRef.current?.dispose();
      plazaRef.current = null;
    };
  }, [reduced]);

  if (fallback) return <BarrierHero />;
  const status = STATUS[reduced ? "blocked" : phase];

  return (
    <div
      aria-hidden
      className="relative mx-auto h-[22rem] w-full max-w-md overflow-hidden rounded-3xl bg-asphalt shadow-2xl select-none sm:h-[26rem] sm:max-w-lg"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        plazaRef.current?.point(
          ((event.clientX - box.left) / box.width) * 2 - 1,
          ((event.clientY - box.top) / box.height) * -2 + 1,
        );
      }}
      onPointerLeave={() => plazaRef.current?.point(0, 0)}
    >
      <motion.canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      />
      {/* The terminal's view of the same moment. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-asphalt via-asphalt/80 to-transparent px-5 pt-12 pb-5">
        <p className="font-mono text-xs text-white/50">claude · ~/acme/billing</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={status.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className={`mt-1 flex items-center gap-2 font-mono text-sm ${status.tone}`}
          >
            {(reduced ? "blocked" : phase) === "blocked" && (
              <span className="size-2 animate-pulse rounded-full bg-signal shadow-[0_0_10px_var(--signal)]" />
            )}
            {phase === "approved" && !reduced && <Check className="size-4" />}
            {status.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
