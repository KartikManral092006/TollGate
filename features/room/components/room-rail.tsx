"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { AllClear } from "@/components/road/all-clear";
import { isOpenStatus, needsReview, type GateView } from "@/features/gates/shared/view";
import { EnvBadge } from "@/features/room/components/gate-status";
import { ParkCountdown } from "@/features/room/components/park-countdown";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import type { Member } from "@/features/room/components/room-header";
import { timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

function jumpTo(gateId: string) {
  const card = document.getElementById(`gate-${gateId}`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  // A short flash so the eye lands on the right card.
  card.animate([{ boxShadow: "0 0 0 3px var(--signal)" }, { boxShadow: "0 0 0 3px transparent" }], {
    duration: 1400,
    easing: "ease-out",
  });
}

// Beside the thread on wide screens: what still needs a decision, oldest first, and who's
// in the room. The thread stays the place to decide; this is the to-do list.
export function RoomRail({
  gates,
  members,
  online,
  reachable = new Set(),
  viewerId,
}: {
  gates: GateView[];
  members: Member[];
  // Members with an open room or gate page right now.
  online: Set<string>;
  // Connected to Tollgate somewhere else (Nexconn online status), not in this room.
  reachable?: Set<string>;
  viewerId: string;
}) {
  const waiting = gates
    .filter((gate) => isOpenStatus(gate.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Calls that went through with TOLLGATE_BYPASS=1 and nobody has looked at yet.
  const unreviewed = gates
    .filter(needsReview)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-s xl:flex">
      <section className="px-5 py-5">
        <h2 className="flex items-baseline gap-2 text-sm font-bold">
          Waiting now
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {waiting.length}
          </span>
        </h2>
        {waiting.length === 0 ? (
          <AllClear className="mt-3" />
        ) : (
          <ul className="mt-2 flex flex-col">
            <AnimatePresence initial={false}>
              {waiting.map((gate) => (
                <motion.li
                  key={gate.id}
                  layout
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    type="button"
                    onClick={() => jumpTo(gate.id)}
                    className="group flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        gate.status === "pending" ? "bg-gate-pending" : "bg-gate-parked",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">TG-{gate.code}</span>
                        <EnvBadge env={gate.env} />
                        {gate.status === "pending" && gate.parksAt && (
                          <ParkCountdown
                            createdAt={gate.createdAt}
                            parksAt={gate.parksAt}
                            compact
                            className="ms-auto"
                          />
                        )}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {gate.command}
                      </span>
                      <span
                        className="block text-xs text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {gate.status === "parked" ? "Parked, " : ""}
                        {gate.requester.name}, {timeAgo(gate.createdAt)}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {unreviewed.length > 0 && (
        <section className="border-t px-5 py-5">
          <h2 className="flex items-baseline gap-2 text-sm font-bold text-gate-denied-fg">
            Bypassed, needs review
            <span className="text-xs font-normal tabular-nums">{unreviewed.length}</span>
          </h2>
          <ul className="mt-2 flex flex-col">
            {unreviewed.map((gate) => (
              <li key={gate.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(gate.id)}
                  className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-gate-denied"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">TG-{gate.code}</span>
                      <EnvBadge env={gate.env} />
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {gate.command}
                    </span>
                    <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
                      {gate.requester.name}, {timeAgo(gate.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t px-5 py-5">
        <h2 className="text-sm font-bold">People</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2.5">
              <span className="relative">
                <PersonAvatar id={member.id} name={member.name} size="sm" />
                {online.has(member.id) || member.id === viewerId ? (
                  <span
                    className="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full bg-gate-approved ring-2 ring-background"
                    aria-label="In this room"
                    title="In this room"
                  />
                ) : (
                  reachable.has(member.id) && (
                    <span
                      className="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-gate-approved bg-background"
                      aria-label="Online in Tollgate"
                      title="Online in Tollgate, not in this room"
                    />
                  )
                )}
              </span>
              <Link
                href={`/people/${member.id}`}
                className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:text-primary hover:underline"
              >
                {member.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABEL[member.role] ?? member.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
