import { ArrowUpRight, Link2, MonitorPlay, ShieldCheck, Terminal, Users } from "lucide-react";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { CreateTeamForm } from "@/features/teams/components/create-team-form";

const STEPS = [
  {
    icon: Users,
    title: "Create a team",
    text: "Name it after your project or company. You're its owner and can invite people later.",
  },
  {
    icon: Terminal,
    title: "Connect your computer",
    text: "Type your repo's name, then paste one command in its folder. About 3 minutes; Tollgate never needs access to GitHub.",
  },
  {
    icon: ShieldCheck,
    title: "Decide from anywhere",
    text: "When Claude Code tries to deploy, migrate, publish or delete, it waits. Your team approves it, or denies it with a reason, here or on a phone.",
  },
] as const;

// Home for someone with no team yet: what Tollgate does in three steps, the one thing to do
// now, and the two other ways in (try it without installing; join through an invite).
export function FirstRun() {
  return (
    <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-16">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="first-team" className="flex flex-col gap-3">
          <h2 id="first-team" className="text-xl font-extrabold tracking-tight">
            Start with a team
          </h2>
          <CreateTeamForm autoFocus placeholder="e.g. Acme web app" />
        </section>

        <section aria-labelledby="next-steps">
          <h2 id="next-steps" className="text-sm font-bold text-muted-foreground">
            What happens next
          </h2>
          <Stagger role="list" className="mt-4 flex flex-col">
            {STEPS.map((step, index) => (
              <StaggerItem
                role="listitem"
                key={step.title}
                className="relative flex gap-4 pb-6 last:pb-0"
              >
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute start-[1.1875rem] top-10 bottom-1 w-px bg-border"
                  />
                )}
                <span className="grid size-10 shrink-0 place-items-center rounded-full border bg-card text-primary">
                  <step.icon className="size-4.5" aria-hidden />
                </span>
                <span className="pt-1.5">
                  <span className="block font-semibold">
                    <span className="text-muted-foreground">{index + 1}.</span> {step.title}
                  </span>
                  <span className="mt-0.5 block max-w-prose text-sm text-muted-foreground">
                    {step.text}
                  </span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </div>

      <aside className="flex flex-col gap-3 lg:pt-11" aria-label="Other ways in">
        <Link
          href="/#demo"
          className="group rounded-xl border bg-card p-4 transition-colors outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 font-semibold">
            <MonitorPlay className="size-4 text-primary" aria-hidden />
            Not ready to install?
            <ArrowUpRight
              className="ms-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Try it in your browser: approve or deny a pretend agent&apos;s migration and see how it
            reacts. Takes a minute.
          </span>
        </Link>
        <div className="rounded-xl border border-dashed p-4">
          <span className="flex items-center gap-2 font-semibold">
            <Link2 className="size-4 text-muted-foreground" aria-hidden />
            Joining someone&apos;s team?
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Open the invite link they sent you. It adds you to their team right away, nothing to set
            up.
          </span>
        </div>
      </aside>
    </div>
  );
}
