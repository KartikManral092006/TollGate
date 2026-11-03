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
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2 pt-2 sm:px-4">
        <Link
          href="/home"
          aria-label="All teams"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-bold tracking-tight">{name}</h1>
          {status && <div className="text-xs text-muted-foreground">{status}</div>}
        </div>
        {actions}
        <ThemeToggle />
      </div>
      <nav aria-label="Team" className="mx-auto w-full max-w-3xl px-2 sm:px-4">
        <ul className="flex gap-1">
          {tabs.map((tab) => {
            const current = tab.href === active;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                  {current && (
                    <motion.span
                      layoutId="team-tab"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-primary"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
