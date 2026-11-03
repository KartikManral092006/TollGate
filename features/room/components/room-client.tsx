"use client";

import { ShieldAlert } from "lucide-react";
import { Fragment, useEffect, useMemo } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AllClear } from "@/components/road/all-clear";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { useCalls } from "@/features/call/client/use-calls";
import { CallBar } from "@/features/call/components/call-bar";
import { GateCallMenu } from "@/features/call/components/gate-call-menu";
import { IncomingCallSheet } from "@/features/call/components/incoming-call";
import { isOpenStatus, type GateView } from "@/features/gates/shared/view";
import { useAlerts } from "@/features/notify/client/use-alerts";
import { SetupGuide } from "@/features/onboarding/components/setup-guide";
import type { SetupState } from "@/features/onboarding/shared/steps";
import { ChatLineView } from "@/features/room/components/chat-line";
import { Composer } from "@/features/room/components/composer";
import { GateCard, type Viewer } from "@/features/room/components/gate-card";
import { RoomHeader, type Member } from "@/features/room/components/room-header";
import { RoomRail } from "@/features/room/components/room-rail";
import { StuckActions } from "@/features/room/components/stuck-actions";
import { usePresence } from "@/features/presence/client/use-presence";
import { useViewingGate } from "@/features/presence/client/use-viewing";
import { presenceFor } from "@/features/presence/shared/presence";
import { useGateActions } from "@/features/room/client/use-gate-actions";
import { useRoomLive } from "@/features/room/client/use-room-live";
import type { ChatLine } from "@/features/room/shared/chat";
import { dayLabel } from "@/features/room/shared/format";

type ThreadItem = (
  | { kind: "gate"; key: string; at: number; gate: GateView }
  | { kind: "line"; key: string; at: number; line: ChatLine }
) & { day: string | null };

export function RoomClient({
  team,
  viewer,
  members,
  initialGates,
  highlightGateId,
  callsEnabled,
  setup,
  serverUrl,
  isOwner,
}: {
  team: { id: string; name: string; channelId: string };
  viewer: Viewer;
  members: Member[];
  initialGates: GateView[];
  highlightGateId: string | null;
  callsEnabled: boolean;
  setup: SetupState;
  serverUrl: string;
  isOwner: boolean;
}) {
  const { gates, lines, live, refresh, send } = useRoomLive({
    teamId: team.id,
    channelId: team.channelId,
    initialGates,
    callsEnabled,
  });
  const alerts = useAlerts({
    gates,
    viewerId: viewer.id,
    canVote: viewer.canVote,
    teamChannelId: team.channelId,
  });
  const calls = useCalls({
    enabled: callsEnabled && live === "live",
    onChange: () => void refresh(),
  });
  const callees = useMemo(
    () =>
      members
        .filter((m) => m.id !== viewer.id && m.role !== "requester")
        .map((m) => ({ id: m.id, name: m.name })),
    [members, viewer.id],
  );
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const actions = useGateActions({ refresh });
  const viewing = useViewingGate(gates);
  const people = usePresence(team.id, { viewing, typing: actions.composing?.id ?? null });
  const online = useMemo(() => new Set(people.map((p) => p.userId)), [people]);
  const presenceOf = (gateId: string) => {
    const ids = presenceFor(gateId, people, viewer.id);
    return {
      looking: ids.looking.map((id) => names.get(id) ?? "A teammate"),
      typing: ids.typing.map((id) => names.get(id) ?? "A teammate"),
    };
  };

  const items = useMemo<ThreadItem[]>(
    () =>
      [
        ...gates.map((gate) => ({
          kind: "gate" as const,
          key: `g-${gate.id}`,
          at: Date.parse(gate.createdAt),
          gate,
        })),
        ...lines.map((line) => ({
          kind: "line" as const,
          key: `l-${line.id}`,
          at: line.sentTime,
          line,
        })),
      ]
        .sort((a, b) => a.at - b.at)
        // A day separator before the first item of each day.
        .map((item, index, sorted) => {
          const day = dayLabel(item.at);
          const previous = index > 0 ? dayLabel(sorted[index - 1]!.at) : null;
          return { ...item, day: day === previous ? null : day };
        }),
    [gates, lines],
  );
  const openCount = gates.filter((gate) => isOpenStatus(gate.status)).length;

  useEffect(() => {
    if (!highlightGateId) return;
    const timer = setTimeout(() => {
      document.getElementById(`gate-${highlightGateId}`)?.scrollIntoView({ block: "center" });
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightGateId]);

  return (
    // Fills the space beside the sidebar (under the phone top bar), so the thread scrolls alone.
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <RoomHeader
        name={team.name}
        members={members}
        live={live}
        openCount={openCount}
        onEnableAlerts={alerts.permission === "default" ? () => void alerts.enable() : undefined}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {items.length === 0 ? (
            // An empty room starts at the top, so the setup guide is the first thing people see.
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 sm:px-6">
                <SetupGuide
                  teamId={team.id}
                  serverUrl={serverUrl}
                  isOwner={isOwner}
                  initial={setup}
                />
                {setup.complete ? (
                  <Empty className="my-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ShieldAlert />
                      </EmptyMedia>
                      <EmptyTitle>No gates yet</EmptyTitle>
                      <EmptyDescription>
                        When a teammate&apos;s coding agent tries something risky, it shows up here
                        for the team to decide.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <p className="text-xs text-muted-foreground">
                        Send a test one with{" "}
                        <code className="font-mono">npx tollgate-cli test</code>.
                      </p>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Gates show up here once your computer is connected.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <MessageScrollerProvider>
              <MessageScroller className="flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-0 px-4 py-4 sm:px-6">
                    <SetupGuide
                      teamId={team.id}
                      serverUrl={serverUrl}
                      isOwner={isOwner}
                      initial={setup}
                    />
                    {items.map((item) => {
                      return (
                        <Fragment key={item.key}>
                          {item.day && (
                            <Marker variant="separator" className="py-3 text-xs">
                              <MarkerContent>{item.day}</MarkerContent>
                            </Marker>
                          )}
                          <MessageScrollerItem>
                            {item.kind === "gate" ? (
                              <GateCard
                                gate={item.gate}
                                viewer={viewer}
                                highlighted={item.gate.id === highlightGateId}
                                onApprove={async (gate) => {
                                  await actions.approve(gate);
                                }}
                                onDeny={actions.deny}
                                onAsk={actions.ask}
                                onRing={
                                  callsEnabled &&
                                  live === "live" &&
                                  !calls.busy &&
                                  calls.active === null
                                    ? (gate, userId) => void calls.ring(gate, userId)
                                    : undefined
                                }
                                onWhy={actions.explain}
                                presence={presenceOf(item.gate.id)}
                                footer={
                                  callsEnabled &&
                                  live === "live" &&
                                  isOpenStatus(item.gate.status) ? (
                                    <GateCallMenu
                                      gate={item.gate}
                                      callees={callees}
                                      disabled={calls.busy || calls.active !== null}
                                      onHuddle={(gate) =>
                                        void calls.huddle(
                                          gate,
                                          members
                                            .filter((m) => m.id !== viewer.id)
                                            .map((m) => m.id),
                                        )
                                      }
                                      onRing={(gate, userId) => void calls.ring(gate, userId)}
                                      onJoin={(gate, call) => void calls.join(gate, call)}
                                    />
                                  ) : undefined
                                }
                              />
                            ) : (
                              <ChatLineView
                                line={item.line}
                                name={names.get(item.line.senderId) ?? "Teammate"}
                              />
                            )}
                          </MessageScrollerItem>
                        </Fragment>
                      );
                    })}
                    {openCount === 0 && (
                      // The side panel says it on wide screens; here it ends the thread.
                      <MessageScrollerItem>
                        <AllClear className="py-6 xl:hidden" />
                      </MessageScrollerItem>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          )}

          <div className="border-t bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
            <StuckActions
              gates={gates}
              onApprove={(gate) => void actions.approve(gate)}
              onDeny={actions.deny}
              onAsk={actions.ask}
            />
            {calls.active && (
              <CallBar
                call={calls.active}
                onMute={() => void calls.toggleMute()}
                onHangUp={() => void calls.hangUp()}
              />
            )}
            <div className="mx-auto w-full max-w-3xl">
              <Composer disabled={live !== "live"} onSend={send} />
            </div>
          </div>
        </div>
        <RoomRail gates={gates} members={members} online={online} viewerId={viewer.id} />
      </div>

      <IncomingCallSheet
        call={calls.incoming}
        callerName={calls.incoming ? (names.get(calls.incoming.callerId) ?? "A teammate") : ""}
        inCall={calls.active !== null}
        onAccept={() => void calls.accept()}
        onDecline={() => void calls.decline()}
      />

      {actions.drawers}
    </div>
  );
}
