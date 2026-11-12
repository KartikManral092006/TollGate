import type { Metadata } from "next";
import {
  C,
  Command,
  DocTitle,
  H2,
  Output,
  P,
  PrevNext,
  Table,
} from "@/features/docs/components/doc";

export const metadata: Metadata = {
  title: "CLI reference · Tollgate docs",
  description: "Every tollgate-cli command, the files it writes, and its environment variables.",
};

export default function CliPage() {
  return (
    <article>
      <DocTitle href="/docs/cli" />

      <P>
        The CLI is on npm as <C>tollgate-cli</C> and needs Node.js 20.19 or newer. Run it with{" "}
        <C>npx</C> from inside the repository.
      </P>

      <H2 id="init">init</H2>
      <Command value="npx -y tollgate-cli@latest init --token tg_… [--server <url>] [--repo <owner/name>]" />
      <P>
        Links this repo on this machine: saves your token, writes <C>.tollgate.json</C>, and
        registers the hook in <C>.claude/settings.json</C>. <C>--repo</C> is only needed when the
        folder&apos;s git remote doesn&apos;t match the repo name in Tollgate. Settings gives you
        the full command, server included. Safe to run again.
      </P>

      <H2 id="status">status</H2>
      <Command value="npx -y tollgate-cli status" />
      <P>Shows the linked repo, server and presets, and checks your token with the server.</P>

      <H2 id="test">test</H2>
      <Command value="npx -y tollgate-cli test" />
      <P>
        Raises a harmless gate for <C>echo tollgate-test</C> and waits for your team, like the agent
        would.
      </P>
      <Output>
        {"Raising a test gate for `echo tollgate-test`. Approve or deny it in the room…"}
      </Output>

      <H2 id="unlink">unlink</H2>
      <Command value="npx -y tollgate-cli unlink" />
      <P>
        Removes this repo&apos;s token from this machine. Revoke it in Settings too, so it
        can&apos;t be used elsewhere.
      </P>

      <H2 id="hook">hook</H2>
      <P>
        <C>tollgate hook</C> is what Claude Code runs before each Bash command, file edit and MCP
        tool call, and again in the background after a gated one runs, to report how it went. You
        don&apos;t run it yourself.
      </P>

      <H2 id="files">Files</H2>
      <Table
        head={["File", "Where", "What"]}
        rows={[
          [
            <C key="1">.tollgate.json</C>,
            "Repo root (commit it)",
            "The repo name, server and presets",
          ],
          [
            <C key="2">.claude/settings.json</C>,
            "Repo",
            "Claude Code's hook entry and its timeout",
          ],
          [
            <C key="3">tokens.json</C>,
            "~/.config/tollgate/ (never the repo)",
            "Your token for each linked repo",
          ],
          [<C key="4">audit.log</C>, "~/.config/tollgate/", "Local record of bypasses"],
          [
            <C key="6">outbox.jsonl</C>,
            "~/.config/tollgate/ (only you can read it)",
            "Bypass reports waiting to reach the server; status shows how many",
          ],
          [
            <C key="5">sessions/</C>,
            "~/.config/tollgate/ (only you can read it)",
            "Per Claude Code session: your last instruction to the agent and its last five calls, redacted. Sent only if your team shares the agent's task; deleted after a week",
          ],
        ]}
      />

      <H2 id="env">Environment variables</H2>
      <Table
        head={["Variable", "Effect"]}
        rows={[
          [
            <C key="1">TOLLGATE_BYPASS=1</C>,
            "Set when starting Claude Code: lets gated commands through. Emergencies only; logged and reported to your team for review.",
          ],
          [
            <C key="2">TOLLGATE_HOME</C>,
            "Where tokens and the audit log live instead of ~/.config/tollgate.",
          ],
        ]}
      />

      <PrevNext href="/docs/cli" />
    </article>
  );
}
