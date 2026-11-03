import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { verifySession } from "@/features/auth/server/session";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";
import { listTeamsForUser } from "@/features/teams/server/teams";
import { db } from "@/lib/db";

export const instant = false;

export const metadata: Metadata = {
  title: "Home · Tollgate",
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  await connection();
  const user = await verifySession("/home");
  const memberships = await listTeamsForUser(db, user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">Hi {user.name || "there"}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Your teams</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teams yet. Create one, or open an invite link a teammate sent you.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {memberships.map(({ team, role }) => (
              <li key={team.id}>
                <Link
                  href={`/teams/${team.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
                >
                  <span className="min-w-0 truncate font-medium">{team.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {role} · {team._count.memberships} people · {team._count.gates} gates
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">New team</h2>
        <CreateTeamForm />
      </section>
    </main>
  );
}
