"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  nexconnEvents,
  startNexconn,
  type NexconnEvent,
  type NexconnSession,
} from "@/features/nexconn/client/engine";
import { DEV_TEST_USERS, type DevTestUser } from "@/features/nexconn/shared/config";

// Spike T6 (PLAN.md §13): with the overridden peer versions, does a ChatUI DM render AND does
// a 1:1 audio call connect, in one page sharing one NCEngine? Dev routes only. Calls placed
// here skip the server permit, so run T7 (Console shows $0) before pressing Ring.
export function CallLab() {
  const [me, setMe] = useState<DevTestUser>("tgalice");
  const [session, setSession] = useState<NexconnSession | null>(null);
  const [events, setEvents] = useState<NexconnEvent[]>([]);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const peer = DEV_TEST_USERS.find((user) => user !== me) ?? "tgbob";

  useEffect(
    () =>
      nexconnEvents.subscribe((event) => {
        setEvents((previous) => [event, ...previous].slice(0, 80));
        if (event.kind === "callReceived") {
          setIncoming((event.data as { callId: string }).callId);
        }
        if (event.kind === "callEnded") setIncoming(null);
      }),
    [],
  );

  async function connect() {
    setError(null);
    try {
      const started = await startNexconn({ devUser: me, withChatUI: true, withCall: true });
      setSession(started);
      const container = chatRef.current;
      if (started.chatui && container && container.childElementCount === 0) {
        const root = document.createElement("nc-chat-ui-app-provider");
        root.style.width = "100%";
        root.style.height = "100%";
        container.appendChild(root);
        const opened = await started.chatui.openChannel(
          new started.chat.DirectChannelIdentifier(peer),
          true,
        );
        nexconnEvents.emit("chatuiOpenChannel", { code: opened.code });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function ring() {
    const call = session?.call;
    if (!call) return;
    const result = await call.engine.startCall({
      calleeIds: [peer],
      callType: call.module.NCCallType.SINGLE,
      mediaType: call.module.NCCallMediaType.AUDIO,
    });
    nexconnEvents.emit("startCall", result);
  }

  async function accept() {
    const call = session?.call;
    if (!call || !incoming) return;
    // In the product this asks first when already in a call: acceptCall silently ends it.
    const result = await call.engine.acceptCall({ callId: incoming });
    nexconnEvents.emit("acceptCall", result);
  }

  async function hangUp() {
    const result = await session?.call?.engine.endCall();
    nexconnEvents.emit("endCall", result ?? null);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Spike T6: ChatUI DM + Call in one engine</h1>
        <p className="text-sm text-muted-foreground">
          Open this page as tgalice in one browser and tgbob in another (or on your phone). Pass
          when the DM renders and a 1:1 audio call connects both ways.
        </p>
        <p className="text-sm font-medium text-destructive">
          Calls here bypass the server permit and are billed. Confirm $0 in the Console (T7) first.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {DEV_TEST_USERS.map((user) => (
          <Button
            key={user}
            variant={user === me ? "default" : "outline"}
            disabled={session !== null}
            onClick={() => setMe(user)}
          >
            {user}
          </Button>
        ))}
        <Button onClick={connect} disabled={session !== null}>
          Connect
        </Button>
        <Button onClick={ring} disabled={!session?.call}>
          Ring {peer}
        </Button>
        <Button onClick={accept} disabled={!incoming}>
          Accept
        </Button>
        <Button variant="outline" onClick={hangUp} disabled={!session?.call}>
          Hang up
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div ref={chatRef} className="h-[480px] overflow-hidden rounded-lg border" />
        <ol className="h-[480px] overflow-auto rounded-lg border p-2 font-mono text-xs">
          {events.map((event) => (
            <li key={event.id} className="border-b py-1 break-all">
              <span className="font-semibold">{event.kind}</span> {JSON.stringify(event.data)}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
