"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, ScrollTrigger } from "@/features/landing/motion/gsap";
import { isTouchOnly, prefersLightEffects } from "@/lib/device";

// Inertial scrolling for the landing page (Lenis), driven by GSAP's ticker so every
// ScrollTrigger reads the same scroll position the page shows. Off for reduced motion, on
// touch screens and on low-end devices.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Phones and tablets scroll natively: smooth already, and what people expect there.
    if (isTouchOnly() || prefersLightEffects()) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.09, anchors: { offset: -72 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
