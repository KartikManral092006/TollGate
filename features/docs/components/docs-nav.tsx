"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { DOC_PAGES } from "@/features/docs/pages";
import { cn } from "@/lib/utils";

// The docs sidebar: a column on wide screens, a scrollable row of tabs on phones.
export function DocsNav() {
  const pathname = usePathname();
  const list = useRef<HTMLUListElement>(null);

  // On phones the pages are a row of tabs: keep the current one in view.
  useEffect(() => {
    const row = list.current;
    const active = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2 });
  }, [pathname]);
  return (
    <nav aria-label="Docs" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 hidden font-mono text-xs text-[#f2a900] lg:block">Docs</p>
      <ul
        ref={list}
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {DOC_PAGES.map((page) => {
          const active = pathname === page.href;
          return (
            <li key={page.href} className="shrink-0">
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-white/[0.07] font-semibold text-white lg:shadow-[inset_2px_0_0_#f2a900]"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
