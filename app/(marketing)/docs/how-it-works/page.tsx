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
        <C>tollgate-cli init</C> registers a <C>PreToolUse</C> hook in{" "}
        <C>.claude/settings.local.json</C>. Claude Code runs it before every Bash command, file edit
        and MCP tool call its agent makes. The hook checks it against your team&apos;s presets on
        your machine. Anything that doesn&apos;t match runs as usual, without anything being sent
        anywhere.
      </P>
      <P>
        It also registers the same hook, in the background, for <C>PostToolUse</C> and{" "}
        <C>PostToolUseFailure</C>. After a gated call runs, it tells the room how it went (see{" "}
        <a href="#after-it-runs" className="underline underline-offset-4">
          After it runs
        </a>
        ). Ungated calls are ignored there too.
      </P>

      <H2 id="edits-and-tools">Edits and tools, not only commands</H2>
      <P>
        An agent that may not run <C>vercel --prod</C> could still change the deploy workflow, or
        call a deploy tool through MCP. So Tollgate also gates:
      </P>
      <List>
        <li>
          Edits that would switch Tollgate off: <C>.claude/settings.json</C>, <C>.tollgate.json</C>,
          and the token in <C>~/.config/tollgate</C>.
        </li>
        <li>
          Deploy and CI files: <C>.github/workflows/</C>, <C>.gitlab-ci.yml</C>, and <C>vercel</C>,{" "}
          <C>netlify</C>, <C>fly</C> and <C>railway</C> config.
        </li>
        <li>
          <C>.env</C> files (not <C>.env.example</C>). The card shows which keys change, never their
          values.
        </li>
        <li>
          MCP tools whose names say they delete, deploy, publish, merge, refund, charge, transfer or
          run SQL, such as <C>mcp__github__merge_pull_request</C>.
        </li>
      </List>
      <P>
        The card shows the change itself, removed lines in red and added lines in green. An approval
        covers that exact change only: a different edit to the same file is a new gate. Ask
        isn&apos;t offered on these gates, because only a Bash call can carry the agent&apos;s
        answer back to the team.
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
        migration&apos;s SQL), the agent&apos;s stated reason, and its Claude Code session id. For
        an edit, the path and the change; for an MCP call, the tool&apos;s name and arguments.
      </P>
      <P>
        If the team&apos;s owner turns on <strong>The agent&apos;s task</strong> (Settings › What
        approvers see), a gate also carries your last instruction to the agent and the calls it made
        since: at most five, as a command&apos;s first line, a file&apos;s path or an MCP
        tool&apos;s name, never its arguments or output. The hook keeps these notes on your machine
        from Claude Code&apos;s <C>UserPromptSubmit</C> and <C>PostToolUse</C> events, only for
        linked repos, with secrets removed before they&apos;re written. It&apos;s off by default.
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

      <H2 id="impact">What it will do</H2>
      <P>
        Once the card is up, the hook runs a few read-only checks on your machine and adds what the
        command will actually do, so approvers judge the effect rather than the command&apos;s text.
        Nothing here changes anything, every check has a time limit, and a check that fails is left
        out.
      </P>
      <Table
        head={["Command", "What the card shows"]}
        rows={[
          [
            "Deploys (vercel, fly, railway)",
            "The branch and commit that go out, uncommitted changes that go with it, commits nobody pushed",
          ],
          [
            "npm, pnpm, yarn, cargo publish",
            "The exact name@version, whether it's public, a missing git tag, private packages",
          ],
          [<C key="rm">rm -rf</C>, "How many files each path holds, and how many git tracks"],
          [
            <C key="pm">prisma migrate deploy</C>,
            "The migrations still waiting (prisma migrate status)",
          ],
          [
            <C key="tf">terraform apply / destroy</C>,
            "The plan's counts and what will be destroyed or replaced first (terraform plan -lock=false, or terraform show for a saved plan)",
          ],
        ]}
      />
      <P>
        The result is redacted like everything else. Set <C>&quot;previews&quot;: false</C> in{" "}
        <C>.tollgate.json</C> to skip them for a repo, for example when <C>terraform plan</C> needs
        credentials the agent&apos;s machine shouldn&apos;t use.
      </P>

      <H2 id="after-it-runs">After it runs</H2>
      <P>
        Once an approved call has run, the card shows whether it succeeded or failed, the exit code
        of a failed command, how long it took, and the last 15 lines of its output (at most 1,000
        characters) with secrets removed the same way. A failure opens its output on the card. The
        audit log and its CSV export include the result too.
      </P>
      <P>
        Nothing is sent for calls that weren&apos;t gated, an MCP tool&apos;s result is never sent,
        and an edit only reports whether it worked. A kind of command whose approved runs often fail
        (more than one in ten) is never offered as a rule to approve automatically.
      </P>
      <P>
        Linked before CLI 0.3? Run <C>npx -y tollgate-cli@latest init</C> again in the repo to
        register the after-the-call hooks, then restart Claude Code.
      </P>

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
          the agent&apos;s shell. Each bypass is logged in <C>~/.config/tollgate/audit.log</C> and,
          from CLI 0.3, reported to the team: it shows in the room as <em>Bypassed</em> with what
          ran and how it went, approvers are notified, and it stays under &ldquo;Bypassed, needs
          review&rdquo; until someone who can approve (not you) marks it reviewed. The report is
          queued on your machine first, so a bypass never waits on the network; it&apos;s sent after
          the call, and retried on later calls if the server can&apos;t be reached.
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
