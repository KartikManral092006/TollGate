"use client";

import { motion } from "motion/react";

// Switching between Room, Audit log and Settings: the page settles in while the sidebar's
// lane marker slides. Turned off by MotionConfig for reduced motion.
export default function TeamTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
