"use client";

import { motion, type HTMLMotionProps } from "motion/react";

// One entrance per page: children arrive in sequence. MotionConfig in Providers turns this off
// for people who prefer reduced motion.
export function Stagger({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 30 } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
