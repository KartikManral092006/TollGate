import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentSessionId, verifySession } from "@/features/auth/server/session";
import { ProfileClient } from "@/features/profile/components/profile-client";
import { loadProfile } from "@/features/profile/server/profile";
import { loadShell } from "@/features/teams/server/shell";
import { ID_RE } from "@/features/teams/shared/schemas";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Profile · Tollgate",
  robots: { index: false, follow: false },
};

// /people/me is your own profile; /people/<id> is a teammate's. People who share no team
// with you get a 404, the same as an id that doesn't exist.
export default async function ProfilePage({ params }: PageProps<"/people/[id]">) {
  await connection();
  const { id } = await params;
  const user = await verifySession(`/people/${id}`);
  if (id === "me") redirect(`/people/${user.id}`);
  if (!ID_RE.test(id)) notFound();

  const [shell, currentSessionId] = await Promise.all([loadShell(user), getCurrentSessionId()]);
  const profile = await loadProfile(db, { viewerId: user.id, targetId: id, currentSessionId });
  if (!profile) notFound();

  return (
    <AppShell user={shell.user} teams={shell.teams} currentTeamId={null}>
      <ProfileClient profile={profile} />
    </AppShell>
  );
}
