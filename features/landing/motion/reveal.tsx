"use client";

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/features/landing/motion/gsap";
import { cn } from "@/lib/utils";

// A section title that rises into view line by line from behind a mask as it scrolls in.
export function RevealTitle({
  text,
  className,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        SplitText.create(ref.current, {
          type: "lines,words",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, {
              yPercent: 110,
              rotate: 4,
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.04,
              scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
            }),
        });
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={cn(className)}>
      {text}
    </Tag>
  );
}

// Children rise in, one after another, the first time the group scrolls into view.
export function Stagger({
  children,
  className,
  selector = ":scope > *",
}: {
  children: React.ReactNode;
  className?: string;
  selector?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = ref.current?.querySelectorAll(selector);
        if (!items?.length) return;
        gsap.from(items, {
          y: 60,
          rotateX: -18,
          autoAlpha: 0,
          transformOrigin: "50% 100%",
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.09,
          scrollTrigger: { trigger: ref.current, start: "top 82%", once: true },
        });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className} style={{ perspective: 1200 }}>
      {children}
    </div>
  );
}
