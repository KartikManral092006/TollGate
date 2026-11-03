"use client";

import { Headphones, Phone, PhoneCall, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GateCallView, GateView } from "@/features/gates/shared/view";

export type Callable = { id: string; name: string };

export function GateCallMenu({
  gate,
  callees,
  disabled,
  onHuddle,
  onRing,
  onJoin,
}: {
  gate: GateView;
  callees: Callable[];
  disabled: boolean;
  onHuddle: (gate: GateView) => void;
  onRing: (gate: GateView, userId: string) => void;
  onJoin: (gate: GateView, call: GateCallView) => void;
}) {
  const live = gate.calls.find((call) => call.kind === "huddle" && call.status === "live");
  if (live) {
    return (
      <Button
        variant="secondary"
        className="h-10 w-full"
        disabled={disabled}
        onClick={() => onJoin(gate, live)}
      >
        <Headphones /> Join huddle · {live.participants} in
      </Button>
    );
  }
  if (callees.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 w-full text-muted-foreground"
            disabled={disabled}
          />
        }
      >
        <PhoneCall /> Talk it through
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onHuddle(gate)}>
            <Users /> Huddle with the team
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ring one person</DropdownMenuLabel>
          {callees.map((person) => (
            <DropdownMenuItem key={person.id} onClick={() => onRing(gate, person.id)}>
              <Phone /> Ring {person.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
