import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { AuditClient } from "@/features/audit/components/audit-client";
import { listTeamGates } from "@/features/gates/server/gates";
import { toGateView } from "@/features/gates/shared/view";
import { TeamHeader } from "@/features/teams/components/team-header";
import { getMembership } from "@/features/teams/server/teams";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Audit log · Tollgate",
  robots: { index: false, follow: false },
};

export default async function AuditPage({ params }: PageProps<"/teams/[id]/audit">) {
  await connection();
  const { id } = await params;
  const user = await verifySession(`/teams/${id}/audit`);
  if (!ID_RE.test(id)) notFound();
  const membership = await getMembership(db, id, user.id);
  if (!membership) notFound();

  const gates = await listTeamGates(db, id, { take: 500 });
  return (
    <div className="flex min-h-dvh flex-col">
      <TeamHeader teamId={id} name={membership.team.name} />
      <AuditClient teamId={id} teamName={membership.team.name} gates={gates.map(toGateView)} />
    </div>
  );
}
