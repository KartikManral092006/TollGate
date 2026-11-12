"use client";

import {
  LayoutGrid,
  ListChecks,
  MessagesSquare,
  Moon,
  Plus,
  ScrollText,
  Settings2,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ShellTeam } from "@/components/shell/app-shell";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { isOpenStatus, type GateView } from "@/features/gates/shared/view";

// ⌘K / Ctrl+K from any signed-in page: jump to a team's page or a waiting gate, or run an
// action, by typing.
export function CommandMenu({
  open,
  onOpenChange,
  teams,
  currentTeamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: ShellTeam[];
  currentTeamId: string | null;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [waiting, setWaiting] = useState<GateView[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // The current team's waiting gates, fetched when the menu opens.
  useEffect(() => {
    if (!open || !currentTeamId) return;
    let cancelled = false;
    fetch(`/api/teams/${currentTeamId}/gates`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { gates: [] }))
      .then((body: { gates: GateView[] }) => {
        if (!cancelled) setWaiting(body.gates.filter((gate) => isOpenStatus(gate.status)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, currentTeamId]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Tollgate"
      description="Jump to a team, a page or a waiting gate"
    >
      {/* Plain substring matching: fuzzy matching finds "aud" scattered through a long
          command and jumps to the wrong gate. */}
      <Command
        filter={(value, search) =>
          value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
        }
      >
        <CommandInput placeholder="Search teams, pages, gates…" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          {waiting.length > 0 && (
            <CommandGroup heading="Waiting for a decision">
              {waiting.map((gate) => (
                <CommandItem
                  key={gate.id}
                  value={`TG-${gate.code} ${gate.preset} ${gate.env} ${gate.command}`}
                  onSelect={() => go(`/teams/${currentTeamId}/gates/${gate.id}`)}
                >
                  <ShieldAlert />
                  <span className="font-mono font-semibold">TG-{gate.code}</span>
                  <span className="truncate text-muted-foreground">{gate.command}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {/* The team you're in first, so Enter picks its page. */}
          {[...teams]
            .sort((a, b) => Number(b.id === currentTeamId) - Number(a.id === currentTeamId))
            .map((team) => (
              <CommandGroup key={team.id} heading={team.name}>
                {[
                  { label: "Room", icon: MessagesSquare, href: `/teams/${team.id}` },
                  { label: "Review", icon: ListChecks, href: `/teams/${team.id}/review` },
                  { label: "Audit log", icon: ScrollText, href: `/teams/${team.id}/audit` },
                  { label: "Settings", icon: Settings2, href: `/teams/${team.id}/settings` },
                ].map((page) => (
                  <CommandItem
                    key={page.href}
                    value={`${team.name} ${page.label}`}
                    onSelect={() => go(page.href)}
                  >
                    <page.icon />
                    {page.label}
                    {page.label === "Room" && team.waiting > 0 && (
                      <CommandShortcut>{team.waiting} waiting</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          <CommandGroup heading="Actions">
            <CommandItem value="All teams home" onSelect={() => go("/home")}>
              <LayoutGrid />
              All teams
            </CommandItem>
            <CommandItem
              value="Your profile account sessions tokens"
              onSelect={() => go("/people/me")}
            >
              <UserRound />
              Your profile
            </CommandItem>
            <CommandItem value="Start a new team" onSelect={() => go("/home#new-team")}>
              <Plus />
              Start a new team
            </CommandItem>
            <CommandItem
              value="Toggle dark mode theme"
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                onOpenChange(false);
              }}
            >
              <Moon />
              {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
