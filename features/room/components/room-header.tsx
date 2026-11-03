"use client";

import { ArrowLeft, Bell, MoreHorizontal, ScrollText, Settings2 } from "lucide-react";
import Link from "next/link";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import type { LiveState } from "@/features/room/client/use-room-live";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: string };

const LIVE_LABEL: Record<LiveState, string> = {
  live: "Live",
  connecting: "Connecting",
  offline: "Updating every few seconds",
};

export function RoomHeader({
  teamId,
  name,
  members,
  live,
  openCount,
  onEnableAlerts,
}: {
  teamId: string;
  name: string;
  members: Member[];
  live: LiveState;
  openCount: number;
  // Shown while browser notifications haven't been allowed yet.
  onEnableAlerts?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/85 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <Link
        href="/home"
        aria-label="All teams"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ArrowLeft />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base leading-tight font-semibold">{name}</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live === "live"
                ? "bg-gate-approved"
                : live === "connecting"
                  ? "animate-pulse bg-gate-pending"
                  : "bg-gate-parked",
            )}
          />
          {LIVE_LABEL[live]}
          {openCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-gate-pending-fg">{openCount} waiting</span>
            </>
          )}
        </p>
      </div>
      <AvatarGroup className="hidden sm:flex">
        {members.slice(0, 4).map((member) => (
          <PersonAvatar key={member.id} id={member.id} name={member.name} size="sm" />
        ))}
        {members.length > 4 && <AvatarGroupCount>+{members.length - 4}</AvatarGroupCount>}
      </AvatarGroup>
      {onEnableAlerts && (
        <Button variant="ghost" size="icon" aria-label="Turn on alerts" onClick={onEnableAlerts}>
          <Bell />
        </Button>
      )}
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Team menu" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={`/teams/${teamId}/audit`} />}>
            <ScrollText /> Audit log
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/teams/${teamId}/settings`} />}>
            <Settings2 /> Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
