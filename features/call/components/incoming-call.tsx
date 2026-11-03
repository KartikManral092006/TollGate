"use client";

import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { IncomingCall } from "@/features/call/client/use-calls";
import { PersonAvatar } from "@/features/room/components/person-avatar";

export function IncomingCallSheet({
  call,
  callerName,
  inCall,
  onAccept,
  onDecline,
}: {
  call: IncomingCall | null;
  callerName: string;
  inCall: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const about =
    call?.extra?.code != null
      ? `${call.extra.kind === "huddle" ? "Huddle" : "Call"} about TG-${call.extra.code}`
      : "Audio call";
  return (
    <Drawer open={call !== null} onOpenChange={(open) => !open && onDecline()}>
      <DrawerContent className="mx-auto w-full max-w-md">
        <DrawerHeader className="items-center gap-3 text-center">
          <span className="relative">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-gate-approved/40"
            />
            {call && <PersonAvatar id={call.callerId} name={callerName} size="lg" />}
          </span>
          <DrawerTitle>{callerName} is calling</DrawerTitle>
          <DrawerDescription>
            {about}
            {inCall && " · answering ends your current call"}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 border-gate-denied/40 text-gate-denied-fg hover:bg-gate-denied-bg"
            onClick={onDecline}
          >
            <PhoneOff /> Decline
          </Button>
          <Button className="h-12" onClick={onAccept}>
            <Phone /> {inCall ? "Switch" : "Answer"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
