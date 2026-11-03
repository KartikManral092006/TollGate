"use client";

import { useEffect, useState } from "react";
import { isOpenStatus, type GateView } from "@/features/gates/shared/view";

// The open gate taking up most of the screen: what this person is "looking at".
export function useViewingGate(gates: GateView[]): string | null {
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    const open = new Set(gates.filter((g) => isOpenStatus(g.status)).map((g) => g.id));
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace(/^gate-/, "");
          if (entry.isIntersecting) ratios.set(id, entry.intersectionRatio);
          else ratios.delete(id);
        }
        let best: string | null = null;
        let bestRatio = 0.25;
        for (const [id, ratio] of ratios) {
          if (open.has(id) && ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setViewing(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    document
      .querySelectorAll<HTMLElement>('article[id^="gate-"]')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [gates]);

  return viewing;
}
