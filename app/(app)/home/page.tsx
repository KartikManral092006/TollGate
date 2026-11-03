import { ChevronRight, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { NamePrompt } from "@/features/auth/components/name-prompt";
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

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

export default async function HomePage() {
  await connection();
  const user = await verifySession("/home");
  const memberships = await listTeamsForUser(db, user.id);
  const waiting = memberships.reduce((total, m) => total + m.team._count.gates, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground">
              <ShieldCheck className="size-4" />
            </span>
            Tollgate
          </span>
          <span className="ms-auto" />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <section className="space-y-1">
          <h1 className="text-2xl font-semibold">Hi {user.name || "there"}</h1>
          <p className="text-sm text-muted-foreground">
            {waiting > 0
              ? `${waiting} ${waiting === 1 ? "gate is" : "gates are"} waiting for a decision.`
              : `Signed in as ${user.email}`}
          </p>
        </section>

        {!user.name.trim() && <NamePrompt />}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Your teams
          </h2>
          {memberships.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center">
              <Users className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="font-medium">No teams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one below, or open an invite link a teammate sent you.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {memberships.map(({ team, role }) => (
                <li key={team.id}>
                  <Link
                    href={`/teams/${team.id}`}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[role] ?? role} · {team._count.memberships}{" "}
                        {team._count.memberships === 1 ? "person" : "people"}
                      </p>
                    </div>
                    {team._count.gates > 0 && (
                      <Badge className="bg-gate-pending-bg text-gate-pending-fg">
                        {team._count.gates} waiting
                      </Badge>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            New team
          </h2>
          <CreateTeamForm />
        </section>
      </main>
    </div>
  );
}
