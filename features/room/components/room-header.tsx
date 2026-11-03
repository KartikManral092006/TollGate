"use client";

import { Bell } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import type { LiveState } from "@/features/room/client/use-room-live";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: string };

const LIVE_LABEL: Record<LiveState, string> = {
  live: "Live",
  connecting: "Connecting…",
  offline: "Auto-refreshing",
};

// The room's own bar: the team, whether the thread is live, what's waiting, who's in it.
// Navigation lives in the sidebar.
export function RoomHeader({
  name,
  members,
  live,
  openCount,
  onEnableAlerts,
}: {
  name: string;
  members: Member[];
  live: LiveState;
  openCount: number;
  // Shown while browser notifications haven't been allowed yet.
  onEnableAlerts?: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight max-lg:sr-only">
          {name}
        </h1>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
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
          </span>
          {openCount > 0 && (
            <span className="font-semibold text-gate-pending-fg">{openCount} waiting</span>
          )}
        </p>
      </div>
      <AvatarGroup className="hidden *:data-[slot=avatar]:ring-background sm:flex">
        {members.slice(0, 5).map((member) => (
          <PersonAvatar key={member.id} id={member.id} name={member.name} size="sm" />
        ))}
        {members.length > 5 && <AvatarGroupCount>+{members.length - 5}</AvatarGroupCount>}
      </AvatarGroup>
      {onEnableAlerts && (
        <Button variant="outline" size="sm" onClick={onEnableAlerts} className="gap-1.5">
          <Bell /> <span className="hidden sm:inline">Turn on alerts</span>
        </Button>
      )}
    </header>
  );
}
