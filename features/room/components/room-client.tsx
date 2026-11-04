"use client";

import { ShieldAlert } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { SessionStrip } from "@/features/room/components/session-strip";
import { useReportSeen } from "@/features/room/client/use-report-seen";
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
import { repliesTo, replyBody, type ChatLine } from "@/features/room/shared/chat";
import { dayLabel } from "@/features/room/shared/format";
import { GateInvite } from "@/features/teams/components/gate-invite";

type ThreadItem = (
  | { kind: "gate"; key: string; at: number; gate: GateView }
  | { kind: "line"; key: string; at: number; line: ChatLine }
  | { kind: "session"; key: string; at: number; gates: GateView[] }
) & { day: string | null };

// Gates grouped by the agent session that raised them, oldest first, for sessions with two or
// more gates. (A loop rather than Map.groupBy: older iPhones in approvers' hands lack it.)
function sessionRuns(gates: GateView[]): GateView[][] {
  const runs = new Map<string, GateView[]>();
  for (const gate of gates) {
    if (!gate.session) continue;
    runs.set(gate.session, [...(runs.get(gate.session) ?? []), gate]);
  }
  return [...runs.values()]
    .filter((run) => run.length > 1)
    .map((run) => [...run].sort((a, b) => a.code - b.code));
}

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
  welcome = false,
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
  // Arrived from an invite made for the highlighted gate.
  welcome?: boolean;
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

  // Gate threads: chat replies attached to a card, by the id they carry or their "TG-17" code.
  const [replying, setReplying] = useState<{ id: string; code: number } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const replies = useMemo(() => {
    const byGate = new Map<string, { id: string; name: string; text: string }[]>();
    for (const gate of gates) {
      const thread = repliesTo(lines, gate);
      if (thread.length === 0) continue;
      byGate.set(
        gate.id,
        thread.map((line) => ({
          id: line.id,
          name: line.mine ? "You" : (names.get(line.senderId) ?? "Teammate"),
          text: replyBody(line.text),
        })),
      );
    }
    return byGate;
  }, [gates, lines, names]);
  const gateOf = (line: ChatLine) => {
    const gate =
      (line.gateId && gates.find((g) => g.id === line.gateId)) ||
      (line.gateCode !== null && gates.find((g) => g.code === line.gateCode)) ||
      null;
    return gate ? { id: gate.id, code: gate.code } : null;
  };
  const jumpTo = (gateId: string) => {
    document
      .getElementById(`gate-${gateId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(gateId);
    setTimeout(() => setFlashId((current) => (current === gateId ? null : current)), 1800);
  };

  const actions = useGateActions({
    refresh,
    repliesFor: (gate) => replies.get(gate.id) ?? [],
  });
  const viewing = useViewingGate(gates);
  useReportSeen({ gates, viewing, viewerId: viewer.id });
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
        // An agent session that raised two or more gates gets a strip just above its first.
        ...sessionRuns(gates).map((run) => ({
          kind: "session" as const,
          key: `s-${run[0]!.session}`,
          at: Date.parse(run[0]!.createdAt) - 1,
          gates: run,
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
        teamId={team.id}
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
                    {/* Someone just invited to decide a gate came for that gate, not the
                        team's setup checklist. */}
                    {!welcome && (
                      <SetupGuide
                        teamId={team.id}
                        serverUrl={serverUrl}
                        isOwner={isOwner}
                        initial={setup}
                      />
                    )}
                    {items.map((item) => {
                      return (
                        <Fragment key={item.key}>
                          {item.day && (
                            <Marker variant="separator" className="py-3 text-xs">
                              <MarkerContent suppressHydrationWarning>{item.day}</MarkerContent>
                            </Marker>
                          )}
                          <MessageScrollerItem>
                            {item.kind === "session" ? (
                              <SessionStrip
                                gates={item.gates}
                                mine={item.gates[0]!.requester.id === viewer.id}
                                onJump={jumpTo}
                              />
                            ) : item.kind === "gate" ? (
                              <GateCard
                                gate={item.gate}
                                viewer={viewer}
                                highlighted={
                                  item.gate.id === highlightGateId || item.gate.id === flashId
                                }
                                replies={replies.get(item.gate.id)}
                                seenBy={(item.gate.seenBy ?? [])
                                  .filter((look) => look.userId !== viewer.id)
                                  .map((look) => look.name)}
                                onReply={live === "live" ? setReplying : undefined}
                                welcome={welcome && item.gate.id === highlightGateId}
                                invite={
                                  isOwner && members.length === 1 ? (
                                    <GateInvite gateId={item.gate.id} code={item.gate.code} />
                                  ) : undefined
                                }
                                onApprove={async (gate, note) => {
                                  await actions.approve(gate, note);
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
                                gate={gateOf(item.line)}
                                onJump={jumpTo}
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
              <Composer
                disabled={live !== "live"}
                reply={replying}
                onCancelReply={() => setReplying(null)}
                onSend={async (text) => {
                  const sent = await send(text, replying ?? undefined);
                  if (sent) setReplying(null);
                  return sent;
                }}
              />
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
