import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { listTeamGates } from "@/features/gates/server/gates";
import { displayName, toGateView } from "@/features/gates/shared/view";
import { withInsights } from "@/features/insights/server/insights";
import { ReviewClient } from "@/features/review/components/review-client";
import { getMembership, listMembers } from "@/features/teams/server/teams";
import { roleCanOpenWindow } from "@/features/gates/shared/windows";
import { canVote, ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Review · Tollgate",
  robots: { index: false, follow: false },
};

// Every waiting gate, one at a time, keyboard first.
export default async function ReviewPage({ params }: PageProps<"/teams/[id]/review">) {
  await connection();
  const { id } = await params;
  const user = await verifySession(`/teams/${id}/review`);
  if (!ID_RE.test(id)) notFound();
  const membership = await getMembership(db, id, user.id);
  if (!membership) notFound();
  const [gates, members] = await Promise.all([listTeamGates(db, id), listMembers(db, id)]);

  return (
    <ReviewClient
      teamId={id}
      viewer={{
        id: user.id,
        canVote: canVote(membership.role),
        canOpenWindows: roleCanOpenWindow(membership.role),
      }}
      initialGates={await withInsights(db, id, gates.map(toGateView))}
      members={members.map((m) => ({ id: m.user.id, name: displayName(m.user.name, m.user.id) }))}
    />
  );
}
