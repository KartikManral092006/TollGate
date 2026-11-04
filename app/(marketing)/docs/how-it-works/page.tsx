import type { Metadata } from "next";
import { C, Callout, DocTitle, H2, List, P, PrevNext, Table } from "@/features/docs/components/doc";

export const metadata: Metadata = {
  title: "How it works · Tollgate docs",
  description:
    "What Tollgate gates, what leaves your laptop, and what happens when it can't reach the server.",
};

export default function HowItWorksPage() {
  return (
    <article>
      <DocTitle href="/docs/how-it-works" />
      <P>
        In short: the hook catches a risky command, hides its secrets, posts it as a card in your
        team room, and waits. Your team&apos;s decision, or the reason for a deny, goes back to the
        agent.
      </P>

      <H2 id="hook">The hook</H2>
      <P>
        <C>tollgate-cli init</C> registers a <C>PreToolUse</C> hook in <C>.claude/settings.json</C>.
        Claude Code runs it before every Bash command its agent makes. The hook checks the command
        against your team&apos;s presets on your machine. Commands that don&apos;t match run as
        usual, without anything being sent anywhere.
      </P>

      <H2 id="see-through">It sees what a command really runs</H2>
      <List>
        <li>
          Package scripts are opened up: <C>pnpm db:deploy</C> is caught as the{" "}
          <C>prisma migrate deploy</C> it runs.
        </li>
        <li>
          Each part of a chained command (<C>&amp;&amp;</C>, <C>;</C>, <C>|</C>) is checked.
        </li>
        <li>
          Code that can&apos;t be read before it runs, like <C>curl … | sh</C> or{" "}
          <C>eval &quot;$CMD&quot;</C>, is gated as unreadable.
        </li>
        <li>
          A dry run (<C>--dry-run</C>) of a deploy, publish or infrastructure change isn&apos;t
          gated. Migrations are gated either way.
        </li>
      </List>

      <H2 id="secrets">What leaves your laptop</H2>
      <P>
        Only gated commands are sent, and secrets are removed on your machine first: private keys,
        passwords in URLs, cloud and API keys and tokens (AWS, GitHub, Slack, Stripe, npm, Google,
        LLM providers), JWTs, bearer tokens, <C>PASSWORD=</C>-style assignments, and every value in
        your <C>.env</C> files. The server removes them again before storing anything, and does the
        same to deny reasons, notes and questions.
      </P>
      <P>
        What&apos;s sent: the redacted command, its folder, the git branch, short context (such as a
        migration&apos;s SQL), the agent&apos;s stated reason, and its Claude Code session id.
      </P>

      <H2 id="waiting">While your team decides</H2>
      <P>
        The agent waits until the hook&apos;s timeout is nearly up (300 seconds by default, minus a
        15-second margin). Then the gate parks and the agent is told to continue with other work. If
        the team approves later, the same command passes once when the agent retries it within 24
        hours.
      </P>

      <H2 id="outcomes">What the agent gets back</H2>
      <Table
        head={["Decision", "Guard mode (default)", "Delegate mode"]}
        rows={[
          [
            "Approved",
            "Claude Code asks you as usual before running it",
            "It runs without Claude Code asking again",
          ],
          ["Denied", "Blocked; your reason is the agent's next instruction", "Same"],
          ["Asked", "Blocked; the agent answers your question in its next attempt", "Same"],
          ["Nobody decided in time", "Parked; the agent moves on and can retry later", "Same"],
        ]}
      />

      <H2 id="fails-closed">If Tollgate can&apos;t be reached</H2>
      <P>
        A risky command is <strong>blocked</strong>, never waved through: if the server can&apos;t
        be reached, the token isn&apos;t accepted, or <C>.tollgate.json</C> is invalid. The agent is
        told to tell you rather than work around it.
      </P>
      <Callout tone="warn" title="Emergency bypass">
        <p>
          A person can start Claude Code with <C>TOLLGATE_BYPASS=1</C> to let gated commands
          through. The agent can&apos;t set it: the hook reads Claude Code&apos;s environment, not
          the agent&apos;s shell. Each bypass is logged in <C>~/.config/tollgate/audit.log</C>.
        </p>
      </Callout>

      <H2 id="limits">What it isn&apos;t</H2>
      <List>
        <li>
          Not a sandbox. It stops the commands its presets recognise; a determined process can still
          do harm in ways it doesn&apos;t inspect, such as inside Makefiles or shell scripts.
        </li>
        <li>It never runs a command itself. It can only stop one.</li>
        <li>
          The <strong>Why?</strong> explanation is help for people. It never approves anything.
        </li>
      </List>

      <PrevNext href="/docs/how-it-works" />
    </article>
  );
}
