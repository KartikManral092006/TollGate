"use client";

import { ArrowLeft, MessagesSquare, ScrollText, Settings2, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon };

// Room, Audit and Settings are always one tap away: beginners shouldn't have to find a menu.
export function TeamHeader({
  teamId,
  name,
  status,
  actions,
}: {
  teamId: string;
  name: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs: Tab[] = [
    { href: `/teams/${teamId}`, label: "Room", icon: MessagesSquare },
    { href: `/teams/${teamId}/audit`, label: "Audit log", icon: ScrollText },
    { href: `/teams/${teamId}/settings`, label: "Settings", icon: Settings2 },
  ];
  const active = tabs.find((tab) => tab.href === pathname)?.href ?? tabs[0]!.href;

  return (
    // The team's pages sit on the road: an asphalt band, tabs marked like lanes.
    <header className="sticky top-0 z-20 bg-asphalt text-white shadow-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2 pt-2 sm:px-4">
        <Link
          href="/home"
          aria-label="All teams"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10",
          )}
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight">{name}</h1>
          {status && <div className="text-xs text-white/70">{status}</div>}
        </div>
        {actions}
        <ThemeToggle className="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
      </div>
      <nav aria-label="Team" className="relative mx-auto w-full max-w-3xl px-2 sm:px-4">
        <ul className="flex gap-1">
          {tabs.map((tab) => {
            const current = tab.href === active;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 pt-2.5 pb-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white",
                    current ? "text-white" : "text-white/60 hover:text-white",
                  )}
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                  {current && (
                    <motion.span
                      layoutId="team-tab"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      className="absolute inset-x-2 bottom-0 h-1 rounded-t-sm bg-signal"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <span
        aria-hidden
        className="block h-0.5 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.22)_0_22px,transparent_22px_40px)]"
      />
    </header>
  );
}
