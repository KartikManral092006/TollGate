import { ArrowRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section } from "@/components/shell/section";
import { buttonVariants } from "@/components/ui/button";
import { NamePrompt } from "@/features/auth/components/name-prompt";
import { verifySession } from "@/features/auth/server/session";
import { FirstRun } from "@/features/onboarding/components/first-run";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";
import { loadShell } from "@/features/teams/server/shell";
import { listTeamsForUser } from "@/features/teams/server/teams";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

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
  const [shell, memberships] = await Promise.all([
    loadShell(user),
    listTeamsForUser(db, user.id, 50),
  ]);
  const waiting = memberships.reduce((total, m) => total + m.team._count.gates, 0);
  const firstWaiting = memberships.find((m) => m.team._count.gates > 0);

  return (
    <AppShell user={shell.user} teams={shell.teams} currentTeamId={null}>
      <PageHeader
        title={`Hi ${user.name.trim().split(/\s+/)[0] || "there"}`}
        description={
          waiting > 0
            ? `${waiting} ${waiting === 1 ? "gate is" : "gates are"} waiting for a decision.`
            : memberships.length > 0
              ? "All clear. No gates are waiting."
              : "Create a team to put a toll gate in front of your coding agent."
        }
        actions={
          firstWaiting && (
            <Link href={`/teams/${firstWaiting.team.id}`} className={buttonVariants()}>
              Review {firstWaiting.team.name}
              <ArrowRight />
            </Link>
          )
        }
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-10">
        {!user.name.trim() && (
          <div className="border-b py-5">
            <NamePrompt />
          </div>
        )}

        {memberships.length > 0 && (
          <Section
            title="Your teams"
            description="Each team has its own room, audit log and repos. Amber means something is waiting for a decision."
          >
            <Stagger role="list" className="divide-y border-y">
              {memberships.map(({ team, role }) => {
                const open = team._count.gates;
                return (
                  <StaggerItem key={team.id} role="listitem">
                    <Link
                      href={`/teams/${team.id}`}
                      className="group flex items-center gap-4 py-3.5 outline-none focus-visible:bg-muted"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          open > 0 ? "bg-gate-pending" : "bg-gate-approved",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold transition-colors group-hover:text-primary">
                          {team.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_LABEL[role] ?? role}, {team._count.memberships}{" "}
                          {team._count.memberships === 1 ? "person" : "people"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm",
                          open > 0 ? "font-semibold text-gate-pending-fg" : "text-muted-foreground",
                        )}
                      >
                        {open > 0 ? `${open} waiting` : "All clear"}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                        aria-hidden
                      />
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </Section>
        )}

        {memberships.length === 0 ? (
          <FirstRun />
        ) : (
          <Section
            id="new-team"
            title="Start a new team"
            description="Usually your project or company. You can link a repo and invite the people who should approve next."
          >
            <CreateTeamForm />
          </Section>
        )}
      </main>
    </AppShell>
  );
}
