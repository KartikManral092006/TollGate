"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

// Scroll-linked effects for the landing page. Reduced motion (MotionConfig) drops the
// movement; anything scrubbed by scroll is shown at its finished state instead.

// A thin bar across the top that fills as the page is read.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-[#2eb67d] via-[#f2a900] to-[#e5485d]"
    />
  );
}

// The hero's two layers move apart as you scroll away: the words drift up and fade, the
// visual tilts back and sinks.
export function HeroParallax({
  text,
  visual,
  className,
}: {
  text: React.ReactNode;
  visual: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const visualRotate = useTransform(scrollYProgress, [0, 1], [0, 14]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  return (
    <div ref={ref} className={className} style={{ perspective: 1200 }}>
      <motion.div style={reduced ? undefined : { y: textY, opacity: textOpacity }}>
        {text}
      </motion.div>
      <motion.div
        style={reduced ? undefined : { y: visualY, rotateX: visualRotate, scale: visualScale }}
      >
        {visual}
      </motion.div>
    </div>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  const y = useTransform(progress, range, [6, 0]);
  return (
    <motion.span style={{ opacity, y }} className="inline-block">
      {children}
    </motion.span>
  );
}

// A heading whose words light up one after another as it scrolls up the screen.
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "start 45%"] });
  const words = text.split(" ");
  if (reduced) return <h2 className={className}>{text}</h2>;
  return (
    <h2 ref={ref} className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden>
          <Word
            progress={scrollYProgress}
            range={[index / words.length, Math.min(1, (index + 1.5) / words.length)]}
          >
            {word}
          </Word>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </h2>
  );
}

// Slides its content sideways as its section scrolls past (the command strips).
export function ScrollShift({
  children,
  distance = 160,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);
  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div style={reduced ? undefined : { x }}>{children}</motion.div>
    </div>
  );
}

// Flies in tilted back in 3D and settles flat; hovering tilts it toward the pointer.
export function TiltIn({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, rotateX: 35, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 110, damping: 18 }}
      onPointerMove={(event) => {
        const el = ref.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = "";
      }}
      style={{ transformPerspective: 900 }}
      className={cn("transition-transform duration-200 ease-out", className)}
    >
      {children}
    </motion.div>
  );
}

// Grows from slightly smaller as it reaches the middle of the screen (the closing panel).
export function ScaleOnScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0.3, 1]);
  return (
    <motion.div ref={ref} style={reduced ? undefined : { scale, opacity }} className={className}>
      {children}
    </motion.div>
  );
}
