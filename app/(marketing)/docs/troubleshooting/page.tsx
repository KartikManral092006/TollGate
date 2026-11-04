import type { Metadata } from "next";
import {
  C,
  Command,
  DocTitle,
  H2,
  List,
  Output,
  P,
  PrevNext,
} from "@/features/docs/components/doc";

export const metadata: Metadata = {
  title: "Troubleshooting · Tollgate docs",
  description:
    "Fixes for the common Tollgate problems: token errors, a hook that doesn't fire, and more.",
};

export default function TroubleshootingPage() {
  return (
    <article>
      <DocTitle href="/docs/troubleshooting" />

      <P>Start here: it checks the link, the server and your token in one go.</P>
      <Command value="npx tollgate-cli status" />
      <Output>{`Repo acme/billing at /work/billing
Server https://toll-gate-mo7d.vercel.app
Presets tollgate-test, staging-deploy, prod-deploy, db-migrate, …
Token tg_7Hq2Kd… OK: team "Billing", guard mode`}</Output>

      <H2 id="401">&ldquo;Tollgate could not reach … (401 unauthorized)&rdquo;</H2>
      <P>The server doesn&apos;t accept the token. Usually one of these:</P>
      <List>
        <li>
          The token was made on a different copy of Tollgate (such as a local one). Tokens only work
          on the server that made them.
        </li>
        <li>It was revoked in Settings, or you were removed from the team.</li>
        <li>Only part of it was copied.</li>
      </List>
      <P>
        Fix: on the live site, open <strong>Settings › Linked repos</strong>, press{" "}
        <strong>New token</strong> next to the repo, and run the command it shows in the repo
        folder.
      </P>

      <H2 id="no-gate">The agent ran a risky command and nothing happened</H2>
      <List>
        <li>
          <strong>Restart Claude Code.</strong> Hooks load when a session starts, so a session
          started before <C>init</C> doesn&apos;t have it.
        </li>
        <li>
          Check that <C>.claude/settings.json</C> in the repo has a <C>PreToolUse</C> entry for{" "}
          <C>Bash</C> that runs <C>tollgate hook</C>. If not, run <C>init</C> again.
        </li>
        <li>
          The command may not match a preset (see{" "}
          <a
            href="/docs/configuration#presets"
            className="text-[#f2c14e] underline-offset-4 hover:underline"
          >
            Configuration
          </a>
          ). Confirm the whole path works with <C>npx tollgate-cli test</C>.
        </li>
      </List>

      <H2 id="token-missing">&ldquo;Token: missing on this machine&rdquo;</H2>
      <P>
        Tokens are per person and per machine, kept outside the repo. Everyone who runs the agent in
        this repo runs <C>init</C> once with their own token. Until then, their risky commands are
        blocked.
      </P>

      <H2 id="invalid-config">&ldquo;.tollgate.json is invalid&rdquo;</H2>
      <P>
        Risky commands are blocked until it&apos;s fixed. Undo the hand edit, or run <C>init</C>{" "}
        again to rewrite it.
      </P>

      <H2 id="own-gate">&ldquo;You can&apos;t approve your own agent&apos;s command&rdquo;</H2>
      <P>
        That&apos;s by design. Press <strong>Invite someone to decide</strong> on the card, or ask a
        teammate in the room.
      </P>

      <H2 id="parked">The gate says &ldquo;Agent stopped waiting&rdquo;</H2>
      <P>
        Nobody decided before the hook&apos;s timeout, so the gate parked. Approve it anyway, then
        ask the agent to run the exact same command again within 24 hours: it passes once.
      </P>

      <H2 id="connecting">
        The room says &ldquo;Connecting…&rdquo; or &ldquo;Auto-refreshing&rdquo;
      </H2>
      <P>
        The live connection isn&apos;t up, so chat is paused and gates refresh every few seconds
        instead. Approving and denying still work. Reload the page; if it persists, check whether a
        firewall or extension blocks WebSockets.
      </P>

      <H2 id="invite">An invite link says it expired or was used</H2>
      <P>
        Gate invites are for one person and last 48 hours; team invites last 72 hours. Ask for a new
        one.
      </P>

      <H2 id="old-cli">Something described here is missing</H2>
      <P>You may have an older CLI cached. Run the latest:</P>
      <Command value="npx tollgate-cli@latest status" />

      <PrevNext href="/docs/troubleshooting" />
    </article>
  );
}
