import type { Metadata } from "next";
import Link from "next/link";
import {
  C,
  Callout,
  Command,
  DocTitle,
  Figure,
  H2,
  List,
  Output,
  P,
  PrevNext,
  Step,
  Steps,
} from "@/features/docs/components/doc";
import invitePreview from "@/features/docs/images/invite-preview.jpg";

export const metadata: Metadata = {
  title: "Quickstart · Tollgate docs",
  description: "Set up Tollgate for Claude Code and get your first gate decided, step by step.",
};

export default function QuickstartPage() {
  return (
    <article>
      <DocTitle href="/docs" />

      <P>
        Tollgate is a hook for Claude Code. Everyday commands run as usual. When your agent is about
        to deploy, migrate a database, publish a package or delete something, Tollgate stops it and
        asks your team in a live room. This page takes about five minutes.
      </P>

      <H2 id="you-need">What you need</H2>
      <List>
        <li>Claude Code, working in a git repository.</li>
        <li>
          Node.js 20.19 or newer (for <C>npx tollgate-cli</C>).
        </li>
        <li>
          A second person to approve: a teammate or a client. You can&apos;t approve your own
          agent&apos;s commands, which is the point.
        </li>
      </List>

      <H2 id="steps">Set it up</H2>
      <Steps>
        <Step title="Sign in and create a team">
          <p>
            <Link href="/sign-in" className="text-[#f2c14e] underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            with Google, GitHub or an email link, then create a team. The team&apos;s room is where
            gates appear.
          </p>
        </Step>
        <Step title="Link your repository">
          <p>
            In the team&apos;s <strong>Settings › Link a repo</strong>, type the repository as{" "}
            <C>owner/name</C>, keep <strong>Guard</strong> mode, and press{" "}
            <strong>Create token</strong>. Copy the command it shows: it&apos;s shown once.
          </p>
          <p>
            Already linked? Press <strong>New token</strong> next to the repo under{" "}
            <strong>Linked repos</strong>.
          </p>
        </Step>
        <Step title="Run the command in the repo folder">
          <Command value="npx tollgate-cli init --server https://toll-gate-mo7d.vercel.app --token tg_…" />
          <p>It prints what it set up:</p>
          <Output>{`✓ Linked acme/billing to team "Billing" (guard mode) as Priya
✓ Token saved to ~/.config/tollgate/tokens.json (only readable by you; never in the repo)
✓ Presets in .tollgate.json: commit this file so your team shares them
✓ Hook registered in .claude/settings.json (timeout 300 s)`}</Output>
          <p>
            Commit <C>.tollgate.json</C>. Each developer runs this once on their own machine with
            their own token.
          </p>
        </Step>
        <Step title="Restart Claude Code">
          <p>
            Claude Code loads hooks when a session starts, so quit and start it again in this repo.
          </p>
        </Step>
        <Step title="Raise a harmless test gate">
          <Command value="npx tollgate-cli test" />
          <p>
            It raises a gate for <C>echo tollgate-test</C> and waits. A card appears in your
            team&apos;s room within a second or two.
          </p>
        </Step>
        <Step title="Get someone else to decide it">
          <p>
            On your waiting card, press <strong>Invite someone to decide TG-1</strong>. You get a
            link and a QR code for one person, valid for 48 hours. They sign in from it, land on the
            gate, and approve or deny. Your terminal prints the outcome.
          </p>
          <p>
            For a standing team, use <strong>Settings › Invite people</strong> instead.
          </p>
        </Step>
      </Steps>

      <Figure
        src={invitePreview}
        narrow
        alt="The invite page on a phone: who invited you, the team, and the waiting gate's repo and command"
        caption="What the invited person sees before signing in."
      />

      <Callout title="Use the exact command from Settings">
        It contains your server address and your token. A token only works on the server that made
        it: one created on a local copy of Tollgate won&apos;t work on the live site.
      </Callout>

      <H2 id="real-work">Try it with your agent</H2>
      <P>Ask Claude Code to run something harmless that Tollgate gates, for example:</P>
      <Command
        value="Clean up the old build cache by running: rm -rf /tmp/tollgate-demo-cache"
        label="Prompt for Claude Code"
      />
      <P>
        Claude Code pauses with <C>Tollgate: waiting on team</C>. Approve it and the agent carries
        on. Deny it with a reason (&ldquo;don&apos;t delete anything, list the folder
        instead&rdquo;) and the agent gets your reason as its next instruction.
      </P>
      <Callout tone="warn" title="Don't test with real deploys">
        <C>vercel --prod</C>, <C>prisma migrate deploy</C> or <C>npm publish</C> are gated too, but
        if someone approves, they really run.
      </Callout>

      <PrevNext href="/docs" />
    </article>
  );
}
