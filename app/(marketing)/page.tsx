import {
  EyeOff,
  MessageSquareWarning,
  PauseCircle,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BarrierHero } from "@/features/landing/components/barrier-hero";
import { Simulator } from "@/features/landing/components/simulator";
import { cn } from "@/lib/utils";

const EXITS = [
  {
    title: "Link your repo",
    body: "Create a team, then run one command in your project. Everyday commands keep running untouched.",
  },
  {
    title: "Your team decides",
    body: "Deploys, migrations, publishes and cloud deletes stop at the gate and land in your team's room, secrets hidden.",
  },
  {
    title: "The agent obeys",
    body: "Approved runs. Denied comes back to the agent with your reason as its next instruction.",
  },
];

const SIGNS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageSquareWarning,
    title: "Deny with a reason",
    body: "“Rename, don't drop” reaches the agent word for word, and it changes its plan.",
  },
  {
    icon: PauseCircle,
    title: "Nobody awake? It parks",
    body: "The agent moves on. Approve later and the same command passes on retry.",
  },
  {
    icon: EyeOff,
    title: "Secrets stay on your machine",
    body: "Commands are cleaned before they leave your laptop, then checked again on the server.",
  },
  {
    icon: ShieldCheck,
    title: "It can only stop things",
    body: "After your team approves, Claude Code still asks you as usual. Tollgate never runs anything.",
  },
  {
    icon: PhoneCall,
    title: "Talk it through",
    body: "Ring a teammate or start a huddle from the card when a decision needs a voice.",
  },
  {
    icon: ScrollText,
    title: "Every decision on record",
    body: "Who approved what, why and how fast, with a CSV export for the post-mortem.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
          <Logo />
          <nav className="ms-auto flex items-center gap-1">
            <a href="#demo" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Try the demo
            </a>
            <ThemeToggle />
            <Link href="/sign-in" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-6">
            {/* The headline is a highway sign: green panel, white inset border. */}
            <h1 className="rounded-2xl bg-[#00704a] p-1.5 text-white shadow-lg">
              <span className="block rounded-xl border-2 border-white/90 px-5 py-6 text-[2.15rem] leading-[1.08] font-extrabold tracking-tight text-balance sm:px-7 sm:py-8 sm:text-5xl">
                Your team decides before your agent does something you can&apos;t undo.
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              When Claude Code is about to deploy to production, change a shared database or publish
              a package, it stops and asks your team in a live thread. One tap approves. A reason
              denies, and the agent changes its plan.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href="#demo"
                className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}
              >
                Try it in your browser
              </a>
              <Link
                href="/sign-in"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className: "h-12 px-6 text-base",
                })}
              >
                Set it up for my team
              </Link>
            </div>
          </div>
          <BarrierHero />
        </section>

        <section id="demo" className="scroll-mt-20 border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="mb-6 max-w-2xl">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                You&apos;re the teammate. Decide.
              </h2>
              <p className="mt-2 text-muted-foreground">
                A coding agent is about to change a shared database. Approve it, deny it with a
                reason, or let it time out, and watch what the agent does. No account needed.
              </p>
            </div>
            <Simulator />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Three exits to a safer agent
          </h2>
          <ol className="relative grid gap-6 md:grid-cols-3">
            <span
              aria-hidden
              className="absolute top-5 right-[16%] left-[16%] hidden h-1 bg-[repeating-linear-gradient(90deg,var(--border)_0_18px,transparent_18px_30px)] md:block"
            />
            {EXITS.map((exit, index) => (
              <li key={exit.title} className="relative flex flex-col gap-3">
                <span className="relative z-10 inline-flex w-fit items-center rounded-lg border-2 border-white bg-[#00704a] px-3 py-1.5 text-sm font-bold text-white shadow ring-2 ring-[#00704a]">
                  Exit {index + 1}
                </span>
                <h3 className="text-lg font-bold">{exit.title}</h3>
                <p className="text-muted-foreground">{exit.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <h2 className="mb-8 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Built for the moment it matters
          </h2>
          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {SIGNS.map((sign) => (
              <li key={sign.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-1 grid size-10 shrink-0 rotate-45 place-items-center rounded-md border-2 border-asphalt bg-signal dark:border-signal-foreground"
                >
                  <sign.icon className="size-4.5 -rotate-45 text-signal-foreground" />
                </span>
                <div>
                  <h3 className="font-bold">{sign.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {sign.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-asphalt px-6 py-10 text-white sm:px-10">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-5 h-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.3)_0_28px,transparent_28px_52px)]"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold tracking-tight">Set it up in two minutes</h2>
                <p className="mt-1 text-white/70">
                  Create a team, run one command in your project, invite whoever should approve.
                </p>
              </div>
              <pre className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm">
                npx tollgate-cli init
              </pre>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 bg-white px-6 text-base text-asphalt hover:bg-white/90",
                )}
              >
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Logo />
          <p className="sm:ms-4">
            Team threads and calls powered by the Nexconn Chat and Call SDKs.
          </p>
          <a
            href="https://github.com/KartikManral092006/TollGate"
            className="underline-offset-4 hover:underline sm:ms-auto"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
