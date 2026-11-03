"use client";

import { ShieldAlert, Terminal } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { ChatLineView } from "@/features/room/components/chat-line";
import { Composer } from "@/features/room/components/composer";
import { DenyDrawer } from "@/features/room/components/deny-drawer";
import { GateCard, type Viewer } from "@/features/room/components/gate-card";
import { RoomHeader, type Member } from "@/features/room/components/room-header";
import { useRoomLive } from "@/features/room/client/use-room-live";
import type { ChatLine } from "@/features/room/shared/chat";
import { dayLabel } from "@/features/room/shared/format";

type ThreadItem =
  | { kind: "gate"; key: string; at: number; gate: GateView }
  | { kind: "line"; key: string; at: number; line: ChatLine };

const VOTE_ERRORS: Record<string, string> = {
  closed: "This gate was already decided.",
  voted: "You already voted on this gate.",
  own_gate: "You can't approve your own agent's command.",
  not_allowed: "Your role can't vote in this team.",
  rate_limited: "Too many votes. Try again in a minute.",
};

export function RoomClient({
  team,
  viewer,
  members,
  initialGates,
  highlightGateId,
  callsEnabled,
  whyEnabled,
}: {
  team: { id: string; name: string; channelId: string };
  viewer: Viewer;
  members: Member[];
  initialGates: GateView[];
  highlightGateId: string | null;
  callsEnabled: boolean;
  whyEnabled: boolean;
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
  const [denying, setDenying] = useState<GateView | null>(null);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

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
      ].sort((a, b) => a.at - b.at),
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

  async function vote(gate: GateView, decision: "approve" | "deny", reason?: string) {
    const response = await fetch(`/api/gates/${gate.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { decision, reason } : { decision }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(VOTE_ERRORS[body.error ?? ""] ?? "Your vote didn't go through. Try again.");
      void refresh();
      return false;
    }
    const result = (await response.json()) as { status: string; approvals: number; quorum: number };
    if (decision === "deny") toast.success(`Denied TG-${gate.code}. The agent gets your reason.`);
    else if (result.status === "approved") toast.success(`TG-${gate.code} approved`);
    else toast.success(`Approved · ${result.approvals}/${result.quorum} so far`);
    void refresh();
    return true;
  }

  async function explain(gate: GateView): Promise<string | null> {
    const response = await fetch(`/api/gates/${gate.id}/why`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return null;
    return ((await response.json()) as { text?: string }).text ?? null;
  }

  let lastDay = "";

  return (
    <div className="flex h-dvh flex-col">
      <RoomHeader
        teamId={team.id}
        name={team.name}
        members={members}
        live={live}
        openCount={openCount}
        onEnableAlerts={alerts.permission === "default" ? () => void alerts.enable() : undefined}
      />

      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-4 px-3 py-4 sm:px-4">
              {items.length === 0 ? (
                <Empty className="my-auto">
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
                    <Link
                      href={`/teams/${team.id}/settings`}
                      className={buttonVariants({ className: "h-10" })}
                    >
                      <Terminal /> Link a repo
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Then run <code className="font-mono">npx tollgate-cli test</code> to see a
                      gate arrive.
                    </p>
                  </EmptyContent>
                </Empty>
              ) : (
                items.map((item) => {
                  const day = dayLabel(item.at);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  return (
                    <Fragment key={item.key}>
                      {showDay && (
                        <Marker variant="separator" className="text-xs">
                          <MarkerContent>{day}</MarkerContent>
                        </Marker>
                      )}
                      <MessageScrollerItem>
                        {item.kind === "gate" ? (
                          <GateCard
                            gate={item.gate}
                            viewer={viewer}
                            highlighted={item.gate.id === highlightGateId}
                            onApprove={async (gate) => {
                              await vote(gate, "approve");
                            }}
                            onDeny={setDenying}
                            onWhy={whyEnabled ? explain : undefined}
                            footer={
                              callsEnabled && live === "live" && isOpenStatus(item.gate.status) ? (
                                <GateCallMenu
                                  gate={item.gate}
                                  callees={callees}
                                  disabled={calls.busy || calls.active !== null}
                                  onHuddle={(gate) =>
                                    void calls.huddle(
                                      gate,
                                      members.filter((m) => m.id !== viewer.id).map((m) => m.id),
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
                })
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        {calls.active && (
          <CallBar
            call={calls.active}
            onMute={() => void calls.toggleMute()}
            onHangUp={() => void calls.hangUp()}
          />
        )}
        <div className="mx-auto w-full max-w-2xl">
          <Composer disabled={live !== "live"} onSend={send} />
        </div>
      </div>

      <IncomingCallSheet
        call={calls.incoming}
        callerName={calls.incoming ? (names.get(calls.incoming.callerId) ?? "A teammate") : ""}
        inCall={calls.active !== null}
        onAccept={() => void calls.accept()}
        onDecline={() => void calls.decline()}
      />

      <DenyDrawer
        gate={denying}
        onClose={() => setDenying(null)}
        onSubmit={(gate, reason) => vote(gate, "deny", reason)}
      />
    </div>
  );
}
