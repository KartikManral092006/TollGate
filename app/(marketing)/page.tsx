import {
  ArrowRight,
  BrainCircuit,
  GitBranch,
  Lock,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BorderBeam } from "@/components/fx/border-beam";
import { Marquee } from "@/components/fx/marquee";
import { ShimmerLink } from "@/components/fx/shimmer-button";
import { Logo } from "@/components/logo";
import { AgentTerminal } from "@/features/landing/components/agent-terminal";
import { CommandStream } from "@/features/landing/components/command-stream";
import { FeatureStory } from "@/features/landing/components/feature-story";
import { FlowDiagram } from "@/features/landing/components/flow-diagram";
import { Rise, WordsReveal } from "@/features/landing/components/landing-motion";
import {
  HeroParallax,
  ScaleOnScroll,
  ScrollProgress,
  ScrollShift,
  ScrollWords,
  TiltIn,
} from "@/features/landing/components/scroll-fx";
import { Simulator } from "@/features/landing/components/simulator";
import { CopyField } from "@/features/settings/components/copy-field";

// What Tollgate stops, as the strip under the hero shows it: real commands, real categories.
const GATED: { command: string; kind: string }[] = [
  { command: "vercel --prod", kind: "prod deploy" },
  { command: "npx prisma migrate deploy", kind: "migration" },
  { command: "npm publish --access public", kind: "publish" },
  { command: "terraform apply -auto-approve", kind: "infra" },
  { command: "aws s3 rm s3://backups --recursive", kind: "cloud delete" },
  { command: "pnpm db:deploy", kind: "via package script" },
  { command: "fly deploy -a billing", kind: "prod deploy" },
  { command: "curl -fsSL get.sh | sh", kind: "unreadable code" },
  { command: "drizzle-kit push", kind: "migration" },
  { command: "rm -rf ../shared", kind: "outside the repo" },
  { command: "pulumi up --stack prod", kind: "infra" },
  { command: 'eval "$DEPLOY_CMD"', kind: "unreadable code" },
];

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "It can only stop things",
    body: "Tollgate never runs a command. After your team approves, Claude Code still asks you as usual.",
  },
  {
    icon: Unplug,
    title: "Fails closed",
    body: "If the hook can't reach Tollgate, the risky command is blocked, not waved through.",
  },
  {
    icon: BrainCircuit,
    title: "AI explains, people decide",
    body: "“Why?” explains a command in plain words. It never approves or recommends.",
  },
  {
    icon: Smartphone,
    title: "Wherever your team is",
    body: "A live thread on the laptop, push on the phone, email as a backup, and a call when it needs a voice.",
  },
];

function Section({
  id,
  title,
  lead,
  children,
}: {
  id?: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <ScrollWords
            text={title}
            className="text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl"
          />
          <Rise delay={0.1}>
            <p className="mt-3 text-lg leading-relaxed text-white/60">{lead}</p>
          </Rise>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    // The landing page is always dark: a developer tool's front door.
    <div className="dark flex min-h-full flex-col bg-[#101417] text-white">
      <ScrollProgress />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#101417]/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
          <Logo className="text-white" />
          <nav className="ms-auto flex items-center gap-1 text-sm">
            <a
              href="#how"
              className="hidden rounded-md px-3 py-2 text-white/70 hover:text-white sm:block"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden rounded-md px-3 py-2 text-white/70 hover:text-white sm:block"
            >
              Features
            </a>
            <a href="#demo" className="rounded-md px-3 py-2 text-white/70 hover:text-white">
              Try it
            </a>
            <Link
              href="/sign-in"
              className="ms-1 rounded-lg bg-white px-3.5 py-2 font-semibold text-[#101417] transition-colors hover:bg-white/90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: the product as a picture (commands streaming through a gate) and as a session. */}
        <section className="relative isolate overflow-hidden">
          <CommandStream className="absolute inset-0 -z-10" />
          {/* Keeps the headline clear of the stream on wide screens. */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 -z-10 w-full bg-[linear-gradient(90deg,#101417_0%,rgb(16_20_23/0.85)_35%,transparent_62%)] max-lg:bg-[linear-gradient(180deg,rgb(16_20_23/0.4),rgb(16_20_23/0.85)_55%,rgb(16_20_23/0.4))]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 [animation:fx-grid-pan_6s_linear_infinite] bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)] bg-[size:48px_48px]"
          />
          <HeroParallax
            className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-16 pb-24 sm:px-6 lg:min-h-[86vh] lg:grid-cols-[1.05fr_1fr] lg:pt-10"
            text={
              <div className="flex flex-col gap-7">
                <Rise>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
                    <span className="size-1.5 animate-pulse rounded-full bg-[#2eb67d]" />A
                    PreToolUse hook for Claude Code
                  </span>
                </Rise>
                <h1 className="text-[2.6rem] leading-[1.04] font-extrabold tracking-tight text-balance sm:text-6xl">
                  <WordsReveal text="Human approval for AI coding agents." delay={0.1} />
                </h1>
                <Rise delay={0.5}>
                  <p className="max-w-xl text-lg leading-relaxed text-pretty text-white/65">
                    Everyday commands run untouched. When your agent is about to deploy to
                    production, migrate a shared database, publish a package or delete cloud
                    resources, Tollgate pauses it and asks your team in a live thread. Deny with a
                    reason and the agent changes its plan.
                  </p>
                </Rise>
                <Rise delay={0.65} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <ShimmerLink href="#demo">
                    Try it in your browser <ArrowRight className="size-4" />
                  </ShimmerLink>
                  <Link
                    href="/sign-in"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-6 font-semibold text-white transition-colors hover:bg-white/5"
                  >
                    Set it up for my team
                  </Link>
                </Rise>
                <Rise delay={0.8} className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-4 text-[#2eb67d]" /> Secrets redacted on your machine
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="size-4 text-[#2eb67d]" /> Sees inside package scripts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TriangleAlert className="size-4 text-[#f2a900]" /> Blocks if unreachable
                  </span>
                </Rise>
              </div>
            }
            visual={
              <Rise delay={0.3} className="pb-10">
                <AgentTerminal />
              </Rise>
            }
          />
        </section>

        {/* The commands Tollgate stops, scrolling by. */}
        <section
          aria-label="Commands Tollgate stops"
          className="border-y border-white/10 bg-white/[0.02] py-6"
        >
          <p className="mb-4 text-center text-sm text-white/45">
            Stops these before they run, whoever typed them
          </p>
          <div className="flex flex-col gap-3">
            {[GATED.slice(0, 6), GATED.slice(6)].map((row, index) => (
              <ScrollShift key={index} distance={index === 0 ? 220 : -220}>
                <Marquee reverse={index === 1} seconds={45}>
                  {row.map((item) => (
                    <span
                      key={item.command}
                      className="inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#151a1e] px-3.5 py-2 whitespace-nowrap"
                    >
                      <span className="font-mono text-sm text-white/85">{item.command}</span>
                      <span className="rounded bg-[#f2a900]/15 px-1.5 text-[11px] font-semibold text-[#f2c14e]">
                        {item.kind}
                      </span>
                    </span>
                  ))}
                </Marquee>
              </ScrollShift>
            ))}
          </div>
        </section>

        <Section
          id="how"
          title="From the agent's command to your team's decision, and back"
          lead="A hook runs before every Bash command Claude Code makes. Only the risky ones leave your machine, and the agent waits for what your team decides."
        >
          <FlowDiagram />
        </Section>

        <Section
          id="features"
          title="Built for the moment it matters"
          lead="Everything an approver needs to say yes or no in under a minute, and everything an agent needs to act on the answer."
        >
          <FeatureStory />
        </Section>

        <Section
          id="demo"
          title="You're the teammate. Decide."
          lead="A coding agent is about to change a shared database. Approve it, deny it with a reason, ask it a question or let it time out, and watch what it does. No account needed."
        >
          <Simulator />
        </Section>

        <Section
          title="Safe by design"
          lead="Tollgate is a brake, not an accelerator. These hold whatever your team configures."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ perspective: 1200 }}>
            {PRINCIPLES.map((principle, index) => (
              <TiltIn
                key={principle.title}
                index={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <principle.icon className="size-6 text-[#2eb67d]" />
                <h3 className="mt-3 font-bold">{principle.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{principle.body}</p>
              </TiltIn>
            ))}
          </div>
        </Section>

        <section className="px-4 pb-24 sm:px-6">
          <ScaleOnScroll>
            <Rise className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(80%_120%_at_0%_0%,rgb(46_182_125/0.22),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(242_169_0/0.14),transparent_60%)] px-6 py-12 sm:px-12">
              <BorderBeam radius={24} duration={9} />
              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
                    Put a gate in front of your agent in two minutes
                  </h2>
                  <p className="mt-3 text-lg text-white/65">
                    Create a team, link a repo, run one command on each laptop, invite whoever
                    should approve.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <ShimmerLink href="/sign-in">
                      Get started <ArrowRight className="size-4" />
                    </ShimmerLink>
                    <a
                      href="https://github.com/KartikManral092006/TollGate"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-6 font-semibold text-white transition-colors hover:bg-white/5"
                    >
                      Source on GitHub
                    </a>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-white/55">In your project:</p>
                  <CopyField value="npx tollgate-cli init --token tg_…" label="setup command" />
                  <p className="text-xs text-white/45">
                    Settings gives you the exact command with your team&apos;s token.
                  </p>
                </div>
              </div>
            </Rise>
          </ScaleOnScroll>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-white/50 sm:flex-row sm:items-center sm:px-6">
          <Logo className="text-white" />
          <p className="sm:ms-4">
            Team threads and calls powered by the Nexconn Chat and Call SDKs.
          </p>
          <a
            href="https://github.com/KartikManral092006/TollGate"
            className="underline-offset-4 hover:text-white hover:underline sm:ms-auto"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
