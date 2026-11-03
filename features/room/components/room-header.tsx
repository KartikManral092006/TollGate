"use client";

import { Bell } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import type { LiveState } from "@/features/room/client/use-room-live";
import { TeamHeader } from "@/features/teams/components/team-header";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: string };

const LIVE_LABEL: Record<LiveState, string> = {
  live: "Live",
  connecting: "Connecting…",
  offline: "Auto-refreshing",
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
    <TeamHeader
      teamId={teamId}
      name={name}
      status={
        <span className="flex flex-wrap items-center gap-x-1.5">
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
              <span className="font-semibold text-gate-pending-fg">{openCount} waiting</span>
            </>
          )}
        </span>
      }
      actions={
        <>
          <AvatarGroup className="hidden sm:flex">
            {members.slice(0, 4).map((member) => (
              <PersonAvatar key={member.id} id={member.id} name={member.name} size="sm" />
            ))}
            {members.length > 4 && <AvatarGroupCount>+{members.length - 4}</AvatarGroupCount>}
          </AvatarGroup>
          {onEnableAlerts && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEnableAlerts}
              className="gap-1.5 text-gate-pending-fg"
            >
              <Bell /> <span className="hidden sm:inline">Turn on alerts</span>
            </Button>
          )}
        </>
      }
    />
  );
}
