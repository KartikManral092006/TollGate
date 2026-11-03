"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Transform and layout animations follow the OS "reduce motion" setting. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </MotionConfig>
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
