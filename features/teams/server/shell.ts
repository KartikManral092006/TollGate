import "server-only";
import type { ShellTeam, ShellUser } from "@/components/shell/app-shell";
import type { SessionUser } from "@/features/auth/server/session";
import { listTeamsForUser } from "@/features/teams/server/teams";
import { db } from "@/lib/db";

// What the sidebar needs: the signed-in person and their teams with waiting counts.
export async function loadShell(
  user: SessionUser,
): Promise<{ user: ShellUser; teams: ShellTeam[] }> {
  const memberships = await listTeamsForUser(db, user.id, 50);
  return {
    user: { id: user.id, name: user.name.trim(), email: user.email },
    teams: memberships.map(({ team, role }) => ({
      id: team.id,
      name: team.name,
      role,
      waiting: team._count.gates,
    })),
  };
}
