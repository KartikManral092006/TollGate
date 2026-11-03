"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// One part of a page: what it is on the left, the controls on the right, a hairline above.
// On phones the two columns stack. Fades up once as it scrolls into view.
export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "grid scroll-mt-6 gap-4 border-t py-8 first:border-t-0 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-12",
        className,
      )}
    >
      <div>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {description && (
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </motion.section>
  );
}

// A list of rows divided by hairlines: tokens, invites, members, rules.
export function RowList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <ul className={cn("divide-y border-y", className)}>{children}</ul>;
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("flex items-center gap-3 py-3 text-sm transition-colors", className)}>
      {children}
    </li>
  );
}
