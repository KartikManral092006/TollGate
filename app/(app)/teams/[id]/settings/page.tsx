import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { displayName } from "@/features/gates/shared/view";
import { loadPolicyState } from "@/features/insights/server/policy";
import { SettingsClient } from "@/features/settings/components/settings-client";
import { loadFreeze } from "@/features/teams/server/freeze";
import { loadSettings } from "@/features/teams/server/settings";
import { getMembership, listMembers } from "@/features/teams/server/teams";
import { ID_RE } from "@/features/teams/shared/schemas";
import { loadAiConfig, toAiConfigView } from "@/features/why/server/config";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Team settings · Tollgate",
  robots: { index: false, follow: false },
};

export default async function SettingsPage({ params }: PageProps<"/teams/[id]/settings">) {
  await connection();
  const { id } = await params;
  const user = await verifySession(`/teams/${id}/settings`);
  if (!ID_RE.test(id)) notFound();
  const membership = await getMembership(db, id, user.id);
  if (!membership) notFound();

  const [members, settings, ai, policy, freeze] = await Promise.all([
    listMembers(db, id),
    loadSettings(db, id, user.id),
    loadAiConfig(db, id),
    loadPolicyState(db, id),
    loadFreeze(db, id),
  ]);
  return (
    <SettingsClient
      teamId={id}
      teamName={membership.team.name}
      viewer={{ id: user.id, role: membership.role }}
      members={members.map((m) => ({
        id: m.user.id,
        name: displayName(m.user.name, m.user.id),
        role: m.role,
        invitedBy: m.invitedBy ? displayName(m.invitedBy.name, m.invitedBy.id) : null,
      }))}
      repos={settings.repos}
      invites={settings.invites}
      ai={toAiConfigView(ai)}
      policy={policy}
      sharing={{ shareAgentTask: membership.team.shareAgentTask }}
      freeze={freeze}
    />
  );
}
