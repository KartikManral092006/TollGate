import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { getTeamGate } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { toGateView } from "@/features/gates/shared/view";
import { withInsights } from "@/features/insights/server/insights";
import { GatePageClient } from "@/features/room/components/gate-page-client";
import { displayName } from "@/features/gates/shared/view";
import { getMembership, listMembers } from "@/features/teams/server/teams";
import { roleCanOpenWindow } from "@/features/gates/shared/windows";
import { canVote, ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Gate · Tollgate",
  robots: { index: false, follow: false },
};

// Where links from email, push and the terminal land: one gate, everything about it.
export default async function GatePage({ params }: PageProps<"/teams/[id]/gates/[gateId]">) {
  await connection();
  const { id, gateId } = await params;
  const user = await verifySession(`/teams/${id}/gates/${gateId}`);
  if (!ID_RE.test(id) || !GATE_ID_RE.test(gateId)) notFound();
  const membership = await getMembership(db, id, user.id);
  if (!membership) notFound();
  const gate = await getTeamGate(db, id, gateId);
  if (!gate) notFound();
  const [[view], members] = await Promise.all([
    withInsights(db, id, [toGateView(gate)]),
    listMembers(db, id),
  ]);

  return (
    <GatePageClient
      teamId={id}
      viewer={{
        id: user.id,
        canVote: canVote(membership.role),
        canOpenWindows: roleCanOpenWindow(membership.role),
      }}
      initial={view!}
      members={members.map((m) => ({ id: m.user.id, name: displayName(m.user.name, m.user.id) }))}
    />
  );
}
