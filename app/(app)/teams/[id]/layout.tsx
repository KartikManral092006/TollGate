import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { verifySession } from "@/features/auth/server/session";
import { loadShell } from "@/features/teams/server/shell";
import { ID_RE } from "@/features/teams/shared/schemas";

// The sidebar stays put while Room, Audit log and Settings change beside it. Each page still
// checks membership itself: a layout doesn't re-run on every navigation.
export default async function TeamLayout({ children, params }: LayoutProps<"/teams/[id]">) {
  await connection();
  const { id } = await params;
  const user = await verifySession(`/teams/${id}`);
  if (!ID_RE.test(id)) notFound();
  const shell = await loadShell(user);
  if (!shell.teams.some((team) => team.id === id)) notFound();
  return (
    <AppShell user={shell.user} teams={shell.teams} currentTeamId={id}>
      {children}
    </AppShell>
  );
}
