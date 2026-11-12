import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { listTeamGates } from "@/features/gates/server/gates";
import { GATE_ID_RE } from "@/features/gates/shared/hook-api";
import { displayName, toGateView } from "@/features/gates/shared/view";
import { withInsights } from "@/features/insights/server/insights";
import { loadSetupState } from "@/features/onboarding/server/setup";
import { RoomClient } from "@/features/room/components/room-client";
import { loadFreeze } from "@/features/teams/server/freeze";
import { getMembership, listMembers } from "@/features/teams/server/teams";
import { roleCanOpenWindow } from "@/features/gates/shared/windows";
import { canVote, ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const instant = false;

export const metadata: Metadata = {
  title: "Team room · Tollgate",
  robots: { index: false, follow: false },
};

export default async function TeamRoomPage({ params, searchParams }: PageProps<"/teams/[id]">) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const user = await verifySession(`/teams/${id}`);
  if (!ID_RE.test(id)) notFound();

  const membership = await getMembership(db, id, user.id);
  if (!membership) notFound();

  const [members, gates, setup, freeze] = await Promise.all([
    listMembers(db, id),
    listTeamGates(db, id),
    loadSetupState(db, id, user.id),
    loadFreeze(db, id),
  ]);
  const views = await withInsights(db, id, gates.map(toGateView));
  const highlight =
    typeof query.gate === "string" && GATE_ID_RE.test(query.gate) ? query.gate : null;

  return (
    <RoomClient
      team={{
        id: membership.team.id,
        name: membership.team.name,
        channelId: membership.team.nexconnChannelId,
      }}
      viewer={{
        id: user.id,
        canVote: canVote(membership.role),
        canOpenWindows: roleCanOpenWindow(membership.role),
      }}
      members={members.map((member) => ({
        id: member.user.id,
        name: displayName(member.user.name, member.user.id),
        role: member.role,
      }))}
      initialGates={views}
      initialFreeze={freeze}
      highlightGateId={highlight}
      callsEnabled={env.CALLS_ENABLED === "1"}
      setup={setup}
      serverUrl={env.NEXT_PUBLIC_APP_URL}
      isOwner={membership.role === "owner"}
      welcome={highlight !== null && query.joined === "1"}
    />
  );
}
