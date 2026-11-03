import {
  ArrowRight,
  BellRing,
  EyeOff,
  MessageSquareWarning,
  PauseCircle,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Simulator } from "@/features/landing/components/simulator";

const STEPS = [
  {
    icon: Terminal,
    title: "Link a repo",
    body: "One command installs a Claude Code hook. Everyday commands run untouched; deploys, migrations, publishes and cloud deletes stop at the gate.",
  },
  {
    icon: Users,
    title: "Your team decides",
    body: "The exact command, with secrets hidden, lands in your team's room. A teammate or your client approves, or denies with a reason, from any phone.",
  },
  {
    icon: MessageSquareWarning,
    title: "The agent obeys",
    body: "Approved runs. Denied comes back to the agent as its next instruction. Nobody around? The gate parks, and approving later lets the retry through.",
  },
];

const FEATURES = [
  {
    icon: MessageSquareWarning,
    title: "Deny with a reason",
    body: "“Rename, don't drop” reaches the agent verbatim and it revises its plan.",
  },
  {
    icon: PauseCircle,
    title: "Works across timezones",
    body: "Unanswered gates park instead of blocking. A later approval becomes a single-use pass.",
  },
  {
    icon: EyeOff,
    title: "Secrets stay home",
    body: "Commands are redacted on your machine before anything is sent, then again on the server.",
  },
  {
    icon: ShieldCheck,
    title: "Guard mode by default",
    body: "Tollgate can only stop commands. After approval, Claude Code still asks you as usual.",
  },
  {
    icon: PhoneCall,
    title: "Talk it through",
    body: "Ring an approver or start a huddle from the card when a decision needs a voice.",
  },
  {
    icon: ScrollText,
    title: "A record of every call",
    body: "Who approved what, why and how fast, with a CSV export for the post-mortem.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground">
              <ShieldCheck className="size-4" />
            </span>
            Tollgate
          </span>
          <nav className="ms-auto flex items-center gap-1">
            <a href="#demo" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Demo
            </a>
            <ThemeToggle />
            <Link href="/sign-in" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pt-16 pb-10 text-center sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <BellRing className="size-3.5" /> For teams that let coding agents near production
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Your team decides before your agent does something you can&apos;t undo.
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            Before Claude Code touches prod, a shared database, a package registry or your cloud, it
            asks your team in a live thread. The conversation decides, the agent obeys, and
            approvals still work when nobody is awake.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="#demo" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
              Try it in your browser <ArrowRight />
            </a>
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-5" })}
            >
              Set up for your team
            </Link>
          </div>
        </section>

        <section id="demo" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-20">
          <Simulator />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            A scripted run in your browser. The real thing is the same card, sent to your team in
            real time.
          </p>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
                    <step.icon className="size-4.5" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {index + 1}
                  </span>
                </span>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Built for the moment it matters
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border bg-card p-5">
                <feature.icon className="mb-3 size-5 text-brand" />
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="flex flex-col items-start gap-4 rounded-3xl bg-zinc-950 p-8 text-zinc-100 sm:flex-row sm:items-center sm:p-10">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">Set it up in two minutes</h2>
              <p className="mt-1 text-zinc-400">
                Create a team, link a repo, run one command. Invite a teammate or your client.
              </p>
            </div>
            <pre className="rounded-xl border border-zinc-800 bg-black px-4 py-3 font-mono text-sm">
              npx tollgate-cli init
            </pre>
            <Link
              href="/sign-in"
              className={buttonVariants({
                size: "lg",
                className: "h-11 bg-white text-black hover:bg-white/90",
              })}
            >
              Get started <ArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>Tollgate · team threads and calls powered by the Nexconn Chat and Call SDKs.</p>
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
