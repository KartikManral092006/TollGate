import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Dot } from "@/components/dot";
import { Logo } from "@/components/logo";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ExitTab, SignPanel } from "@/components/road/sign-panel";
import { TrafficLight } from "@/components/road/traffic-light";
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
  const firstWaiting = memberships.find((m) => m.team._count.gates > 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3">
          <Logo href="/home" />
          <span className="ms-auto" />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Stagger className="flex flex-col gap-8">
          <StaggerItem>
            <SignPanel innerClassName="flex flex-col gap-3 px-5 py-6 sm:px-7">
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
                Hi {user.name.trim().split(/\s+/)[0] || "there"}
              </h1>
              <p className="text-white/85">
                {waiting > 0
                  ? `${waiting} ${waiting === 1 ? "gate is" : "gates are"} waiting for a decision.`
                  : memberships.length > 0
                    ? "All clear. No gates are waiting."
                    : "Create a team to put a toll gate in front of your coding agent."}
              </p>
              {firstWaiting && (
                <Link
                  href={`/teams/${firstWaiting.team.id}`}
                  className="w-fit rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ExitTab className="bg-signal text-signal-foreground ring-signal">
                    Review {firstWaiting.team.name}
                    <ChevronRight className="size-4" />
                  </ExitTab>
                </Link>
              )}
            </SignPanel>
          </StaggerItem>

          {!user.name.trim() && (
            <StaggerItem>
              <NamePrompt />
            </StaggerItem>
          )}

          <StaggerItem className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Your teams</h2>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams yet. Start one below, or open an invite link a teammate sent you.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {memberships.map(({ team, role }) => {
                  const open = team._count.gates;
                  return (
                    <li key={team.id}>
                      <Link
                        href={`/teams/${team.id}`}
                        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card px-4 py-4 shadow-xs transition-[transform,box-shadow] outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 start-0 w-1.5 ${open > 0 ? "bg-gate-pending" : "bg-gate-approved"}`}
                        />
                        <TrafficLight lit={open > 0 ? "amber" : "green"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold">{team.name}</p>
                          <p className="flex items-center text-xs text-muted-foreground">
                            {ROLE_LABEL[role] ?? role}
                            <Dot />
                            {team._count.memberships}{" "}
                            {team._count.memberships === 1 ? "person" : "people"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-semibold ${open > 0 ? "text-gate-pending-fg" : "text-muted-foreground"}`}
                        >
                          {open > 0 ? `${open} waiting` : "All clear"}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </StaggerItem>

          <StaggerItem>
            <CreateTeamForm startOpen={memberships.length === 0} />
          </StaggerItem>
        </Stagger>
      </main>
    </div>
  );
}
