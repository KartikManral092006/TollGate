import {
  ArrowRight,
  BrainCircuit,
  ShieldCheck,
  Smartphone,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BorderBeam } from "@/components/fx/border-beam";
import { Marquee } from "@/components/fx/marquee";
import { ShimmerLink } from "@/components/fx/shimmer-button";
import { Logo } from "@/components/logo";
import { FeatureStory } from "@/features/landing/components/feature-story";
import { LandingFooter } from "@/features/landing/components/footer";
import { Hero } from "@/features/landing/components/hero";
import { Rise } from "@/features/landing/components/landing-motion";
import { Pipeline } from "@/features/landing/components/pipeline";
import {
  ScaleOnScroll,
  ScrollProgress,
  ScrollShift,
} from "@/features/landing/components/scroll-fx";
import { Simulator } from "@/features/landing/components/simulator";
import { RevealTitle, Stagger } from "@/features/landing/motion/reveal";
import { SmoothScroll } from "@/features/landing/motion/smooth-scroll";
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
          <RevealTitle
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
    <div className="dark flex min-h-full flex-col bg-[#0b0f12] text-white">
      <SmoothScroll />
      <ScrollProgress />
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#0b0f12]/60 backdrop-blur-xl">
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
        <Hero />

        {/* The commands Tollgate stops, scrolling by. */}
        <section
          aria-label="Commands Tollgate stops"
          className="border-y border-white/10 bg-white/[0.02] py-6"
        >
          <p className="mb-4 text-center text-sm text-white/45">
            Caught at the gate, before a single one runs
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

        <Pipeline />

        <Section
          id="features"
          title="Everything you need to say yes or no in a minute"
          lead="What the command really runs, what could break, and what your team decided last time. Then the agent acts on your answer."
        >
          <FeatureStory />
        </Section>

        <Section
          id="demo"
          title="You're the approver. Make the call."
          lead="A coding agent is about to change a shared database. Approve it, deny it with a reason, ask it a question or let it time out, and watch what it does. No account needed."
        >
          <Simulator />
        </Section>

        <Section
          title="A brake, never an accelerator"
          lead="Tollgate can only stop things. These hold whatever your team configures."
        >
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#f2a900]/40"
              >
                <span
                  aria-hidden
                  className="absolute -top-16 -right-16 size-40 rounded-full bg-[#f2a900]/0 blur-3xl transition-colors duration-500 group-hover:bg-[#f2a900]/15"
                />
                <principle.icon className="size-6 text-[#2ee59d]" />
                <h3 className="mt-3 font-bold">{principle.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{principle.body}</p>
              </div>
            ))}
          </Stagger>
        </Section>

        <section className="px-4 pb-24 sm:px-6">
          <ScaleOnScroll>
            <Rise className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(80%_120%_at_0%_0%,rgb(46_182_125/0.22),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(242_169_0/0.14),transparent_60%)] px-6 py-12 sm:px-12">
              <BorderBeam radius={24} duration={9} />
              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
                    Put a gate in front of your agent today
                  </h2>
                  <p className="mt-3 text-lg text-white/65">
                    Two minutes to set up: create a team, link a repo, run one command, invite
                    whoever should decide.
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

      <LandingFooter />
    </div>
  );
}
