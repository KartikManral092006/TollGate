"use client";

import { AnimatePresence, motion } from "motion/react";
import { isOpenStatus, type GateView } from "@/features/gates/shared/view";
import { EnvBadge } from "@/features/room/components/gate-status";
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
export function RoomRail({ gates, members }: { gates: GateView[]; members: Member[] }) {
  const waiting = gates
    .filter((gate) => isOpenStatus(gate.status))
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
          <p className="mt-2 text-sm text-muted-foreground">Nothing is waiting. All clear.</p>
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
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {gate.command}
                      </span>
                      <span className="block text-xs text-muted-foreground">
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

      <section className="border-t px-5 py-5">
        <h2 className="text-sm font-bold">People</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2.5">
              <PersonAvatar id={member.id} name={member.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
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
