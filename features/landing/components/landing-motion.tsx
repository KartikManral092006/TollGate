"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// The headline arrives word by word, each one sharpening out of a blur. Reduced motion
// (MotionConfig in Providers) keeps the fade and drops the movement.
export function WordsReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={cn("inline", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, index) => (
          // The space sits between the inline blocks: inside one it would collapse.
          <span key={`${word}-${index}`}>
            <motion.span
              initial={{ opacity: 0, filter: "blur(10px)", y: 12 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ delay: delay + index * 0.08, duration: 0.5, ease: [0.2, 0, 0, 1] }}
              className="inline-block"
            >
              {word}
            </motion.span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}

// A section heading block that rises into place as it scrolls into view.
export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
