"use client";

import {
  AtSign,
  Bell,
  BellOff,
  BellRing,
  Check,
  ListChecks,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatNotify } from "@/features/room/client/use-chat-notify";
import Link from "next/link";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import type { LiveState } from "@/features/room/client/use-room-live";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: string };

const LIVE_LABEL: Record<LiveState, string> = {
  live: "Live",
  connecting: "Connecting…",
  offline: "Auto-refreshing",
};

const NOTIFY_CHOICES: { value: ChatNotify; label: string; icon: typeof Bell }[] = [
  { value: "all", label: "Every message", icon: BellRing },
  { value: "mentions", label: "Only when I'm @mentioned", icon: AtSign },
  { value: "none", label: "Nothing (muted)", icon: BellOff },
];

// The room's own bar: the team, whether the thread is live, what's waiting, who's in it.
// Navigation lives in the sidebar.
export function RoomHeader({
  teamId,
  name,
  members,
  live,
  openCount,
  onEnableAlerts,
  chatNotify,
  onChatNotify,
}: {
  teamId: string;
  name: string;
  members: Member[];
  live: LiveState;
  openCount: number;
  // Shown while browser notifications haven't been allowed yet.
  onEnableAlerts?: () => void;
  // How the team's chat notifies you (Nexconn do-not-disturb); gate alerts are separate.
  chatNotify?: ChatNotify | null;
  onChatNotify?: (next: ChatNotify) => void;
}) {
  // A chat bubble, not a bell: the bells in the top bar are for gates and alerts.
  const NotifyIcon =
    chatNotify === "none" ? MessageSquareOff : chatNotify === "mentions" ? AtSign : MessageSquare;
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
      <AvatarGroup className="hidden *:data-[slot=avatar]:ring-background sm:flex xl:hidden">
        {members.slice(0, 5).map((member) => (
          <PersonAvatar key={member.id} id={member.id} name={member.name} size="sm" />
        ))}
        {members.length > 5 && <AvatarGroupCount>+{members.length - 5}</AvatarGroupCount>}
      </AvatarGroup>
      {openCount > 0 && (
        <Link href={`/teams/${teamId}/review`} className={buttonVariants({ size: "sm" })}>
          <ListChecks /> Review
        </Link>
      )}
      {onChatNotify && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Chat notifications"
                title="Chat notifications"
              />
            }
          >
            <NotifyIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Notify me about chat messages</DropdownMenuLabel>
              {NOTIFY_CHOICES.map((choice) => (
                <DropdownMenuItem key={choice.value} onClick={() => onChatNotify(choice.value)}>
                  <choice.icon /> {choice.label}
                  {chatNotify === choice.value && <Check className="ms-auto" aria-label="On" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Gates always notify you, whatever you choose here.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {onEnableAlerts && (
        <Button variant="outline" size="sm" onClick={onEnableAlerts} className="gap-1.5">
          <Bell /> <span className="sm:hidden">Alerts</span>
          <span className="hidden sm:inline">Turn on alerts</span>
        </Button>
      )}
    </header>
  );
}
