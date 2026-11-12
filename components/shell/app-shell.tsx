"use client";

import {
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  ScrollText,
  Search,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/shell/command-menu";
import { ActivityBell } from "@/features/activity/components/activity-bell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { signOutAction } from "@/features/auth/server/actions";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { cn } from "@/lib/utils";

export type ShellTeam = { id: string; name: string; role: string; waiting: number };
export type ShellUser = { id: string; name: string; email: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

type NavLink = { href: string; label: string; icon: LucideIcon; count?: number };

function NavItem({
  link,
  active,
  nested = false,
}: {
  link: NavLink;
  active: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 rounded-md pe-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal",
        nested ? "ps-7" : "ps-3",
        active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
      )}
    >
      {/* The lane marker: one amber bar that slides to the page you're on. */}
      {active && (
        <motion.span
          layoutId="shell-lane-marker"
          transition={{ type: "spring", stiffness: 520, damping: 42 }}
          className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-signal"
        />
      )}
      <link.icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      {link.count ? (
        <span className="rounded-full bg-signal px-1.5 text-xs leading-5 font-bold text-signal-foreground tabular-nums">
          {link.count}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarBody({
  user,
  teams,
  currentTeamId,
  onSearch,
}: {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeamId: string | null;
  onSearch: () => void;
}) {
  const pathname = usePathname();
  const current = teams.find((team) => team.id === currentTeamId) ?? null;
  const teamLinks: NavLink[] = current
    ? [
        {
          href: `/teams/${current.id}`,
          label: "Room",
          icon: MessagesSquare,
          count: current.waiting,
        },
        { href: `/teams/${current.id}/review`, label: "Review", icon: ListChecks },
        { href: `/teams/${current.id}/audit`, label: "Audit log", icon: ScrollText },
        { href: `/teams/${current.id}/settings`, label: "Settings", icon: Settings2 },
      ]
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 pe-2">
        <Link
          href="/home"
          className="flex items-center gap-2 rounded-md text-base font-extrabold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <LogoMark className="size-6" />
          Tollgate
        </Link>
        <ActivityBell className="ms-auto text-white/70 hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
      </div>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-3"
      >
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 items-center gap-2.5 rounded-md bg-white/5 px-3 text-sm text-white/55 ring-1 ring-white/10 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-signal"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-start">Search…</span>
          <kbd className="rounded bg-white/10 px-1.5 text-[11px] text-white/60">⌘K</kbd>
        </button>
        <NavItem
          link={{ href: "/home", label: "All teams", icon: LayoutGrid }}
          active={pathname === "/home"}
        />

        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-xs font-semibold text-white/45">Your teams</p>
          {teams.map((team) => {
            const isCurrent = team.id === currentTeamId;
            return (
              <div key={team.id} className="flex flex-col gap-0.5">
                <Link
                  href={`/teams/${team.id}`}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal",
                    isCurrent
                      ? "font-semibold text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      team.waiting > 0 ? "bg-signal" : "bg-[#2eb67d]",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  {!isCurrent && team.waiting > 0 && (
                    <span className="text-xs font-semibold text-signal tabular-nums">
                      {team.waiting}
                    </span>
                  )}
                </Link>
                {isCurrent && (
                  <div className="relative flex flex-col gap-0.5">
                    {/* The team's pages hang off it like exits off a road. */}
                    <span
                      aria-hidden
                      className="absolute inset-y-1 start-[1.05rem] w-px bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.25)_0_6px,transparent_6px_11px)]"
                    />
                    {teamLinks.map((link) => (
                      <NavItem key={link.href} link={link} active={pathname === link.href} nested />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Link
            href="/home#new-team"
            className="flex h-9 items-center gap-2.5 rounded-md px-3 text-sm text-white/50 transition-colors outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-signal"
          >
            <Plus className="size-4" aria-hidden />
            New team
          </Link>
        </div>
      </nav>

      <div className="flex shrink-0 items-center gap-1 border-t border-white/10 px-2 py-2.5">
        <Link
          href="/people/me"
          aria-current={pathname === `/people/${user.id}` ? "page" : undefined}
          title="Your profile"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-signal",
            pathname === `/people/${user.id}` && "bg-white/10",
          )}
        >
          <PersonAvatar id={user.id} name={user.name || user.email} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">
              {user.name || "You"}
            </span>
            <span className="block truncate text-xs text-white/50">
              {current ? (ROLE_LABEL[current.role] ?? current.role) : "Your profile"}
            </span>
          </span>
        </Link>
        <ThemeToggle className="text-white/70 hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            className="text-white/70 hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
          >
            <LogOut />
          </Button>
        </form>
      </div>
    </div>
  );
}

// Every signed-in page: a fixed asphalt sidebar on desktop, a top bar with a slide-out
// menu on phones. Content is left-aligned and uses the width it's given.
export function AppShell({
  user,
  teams,
  currentTeamId,
  children,
}: {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeamId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const current = teams.find((team) => team.id === currentTeamId) ?? null;

  // Close the phone menu after navigating.
  useEffect(() => {
    const timer = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const body = (
    <SidebarBody
      user={user}
      teams={teams}
      currentTeamId={currentTeamId}
      onSearch={() => {
        setMenuOpen(false);
        setSearchOpen(true);
      }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh bg-asphalt text-white lg:block">
        {body}
        {/* A dashed lane line runs down the road's edge. */}
        <span
          aria-hidden
          className="absolute inset-y-0 end-0 w-px bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.14)_0_14px,transparent_14px_26px)]"
        />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-asphalt px-2 text-white lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          className="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
        >
          <Menu />
        </Button>
        <p className="min-w-0 flex-1 truncate font-bold">{current?.name ?? "Tollgate"}</p>
        <ActivityBell className="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
        {current && current.waiting > 0 && (
          <Link
            href={`/teams/${current.id}`}
            className="me-2 rounded-full bg-signal px-2 text-xs leading-6 font-bold text-signal-foreground"
          >
            {current.waiting} waiting
          </Link>
        )}
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 gap-0 border-0 bg-asphalt p-0 text-white"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandMenu
        open={searchOpen}
        onOpenChange={setSearchOpen}
        teams={teams}
        currentTeamId={currentTeamId}
      />
    </div>
  );
}
