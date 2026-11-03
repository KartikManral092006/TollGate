"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

// The landing page's motion, all driven by Motion and turned off for reduced motion by the
// MotionConfig in Providers (transforms stop; opacity still fades).

// The headline sign arrives like a sign being hung: a short drop and a settle.
export function SignDrop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -28, rotate: -2.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.1 }}
      style={{ transformOrigin: "50% 0%" }}
      className={className}
    >
      {children}
    </motion.h1>
  );
}

// The three exits, joined by a road line that draws itself as the section scrolls past, each
// exit sign arriving in turn.
export function ExitsRoad({ exits }: { exits: { title: string; body: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "center 45%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const scaleX = useTransform(progress, [0, 1], [0, 1]);

  return (
    <ol ref={ref} className="relative grid gap-6 md:grid-cols-3">
      <motion.span
        aria-hidden
        style={{ scaleX: reduced ? 1 : scaleX, transformOrigin: "0% 50%" }}
        className="absolute top-5 right-[16%] left-[16%] hidden h-1 bg-[repeating-linear-gradient(90deg,var(--border)_0_18px,transparent_18px_30px)] md:block"
      />
      {exits.map((exit, index) => (
        <motion.li
          key={exit.title}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ delay: index * 0.18, duration: 0.45, ease: [0.2, 0, 0, 1] }}
          className="relative flex flex-col gap-3"
        >
          <motion.span
            initial={{ scale: 0.6, rotate: -8 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.18 + 0.1, type: "spring", stiffness: 260, damping: 14 }}
            className="relative z-10 inline-flex w-fit items-center rounded-lg border-2 border-white bg-[#00704a] px-3 py-1.5 text-sm font-bold text-white shadow ring-2 ring-[#00704a]"
          >
            Exit {index + 1}
          </motion.span>
          <h3 className="text-lg font-bold">{exit.title}</h3>
          <p className="text-muted-foreground">{exit.body}</p>
        </motion.li>
      ))}
    </ol>
  );
}

// A diamond warning sign that spins into place when it scrolls into view.
export function SpinSign({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      aria-hidden
      initial={{ rotate: -135, scale: 0.4, opacity: 0 }}
      whileInView={{ rotate: 45, scale: 1, opacity: 1 }}
      whileHover={{ rotate: 45 + 90, transition: { type: "spring", stiffness: 200, damping: 12 } }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ delay: (index % 3) * 0.12, type: "spring", stiffness: 180, damping: 13 }}
      className={cn("grid place-items-center", className)}
    >
      {children}
    </motion.span>
  );
}

// The closing band's lane line, rolling by like the road under you.
export function MovingLane({ className }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ backgroundPositionX: ["0px", "-52px"] }}
      transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
      className={cn(
        "absolute inset-x-0 bottom-5 h-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.3)_0_28px,transparent_28px_52px)]",
        className,
      )}
    />
  );
}
