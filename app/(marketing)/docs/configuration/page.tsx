import type { Metadata } from "next";
import { C, Callout, DocTitle, H2, List, P, PrevNext, Table } from "@/features/docs/components/doc";

export const metadata: Metadata = {
  title: "Configuration · Tollgate docs",
  description:
    "Tollgate presets, Guard and Delegate modes, roles, team rules, invites and notifications.",
};

export default function ConfigurationPage() {
  return (
    <article>
      <DocTitle href="/docs/configuration" />

      <H2 id="presets">What gets gated: presets</H2>
      <P>
        Each linked repo starts with these presets. The first one that matches decides the kind of
        gate and how many approvals it needs.
      </P>
      <Table
        head={["Preset", "Catches, for example", "Approvals"]}
        rows={[
          [<C key="1">prod-deploy</C>, "vercel --prod, fly deploy, railway up to production", "2"],
          [<C key="2">staging-deploy</C>, "fly deploy to a staging app", "1"],
          [
            <C key="3">db-migrate</C>,
            "prisma migrate deploy / reset, prisma db push, drizzle-kit push, destructive psql",
            "1, or 2 in production",
          ],
          [<C key="4">publish</C>, "npm, pnpm or yarn publish (and other package registries)", "1"],
          [
            <C key="5">infra</C>,
            "terraform apply / destroy, pulumi up / destroy, aws … delete-*, aws s3 rm",
            "2",
          ],
          [
            <C key="6">opaque</C>,
            "code that can't be read first: curl … | sh, base64 -d | sh, eval",
            "1",
          ],
          [<C key="7">destructive-fs</C>, "rm -rf on paths outside the repo", "1"],
          [<C key="8">tollgate-test</C>, "echo tollgate-test (the test gate)", "1"],
          [
            <C key="9">guard-config</C>,
            "edits to .claude/settings.json, .tollgate.json or the Tollgate token",
            "1",
          ],
          [
            <C key="10">ci-config</C>,
            "edits to .github/workflows/, .gitlab-ci.yml, vercel, netlify, fly or railway config",
            "1, or 2 in production",
          ],
          [<C key="11">env-file</C>, "edits to .env files (not .env.example)", "1"],
          [
            <C key="12">mcp-risky</C>,
            "MCP tools that delete, deploy, publish, merge, refund, charge or run SQL",
            "1, or 2 in production",
          ],
        ]}
      />
      <P>
        <C>init</C> writes the presets into <C>.tollgate.json</C> at the repo root. Commit it so
        everyone on the team is gated the same way.
      </P>
      <P>
        To add your own, give a preset a <C>&quot;tool&quot;</C> of <C>&quot;edit&quot;</C> or{" "}
        <C>&quot;mcp&quot;</C>. Edit patterns are matched against <C>edit path/to/file</C> (or{" "}
        <C>write …</C> for a new file), MCP patterns against{" "}
        <C>mcp__server__tool {"{arguments}"}</C>. Presets without a tool match Bash commands.
      </P>

      <H2 id="timeout">How long the agent waits</H2>
      <P>
        Set <C>hookTimeoutSec</C> in <C>.tollgate.json</C> (30 to 600 seconds, default 300), then
        run <C>npx -y tollgate-cli@latest init</C> again so Claude Code&apos;s hook timeout matches.
        The hook parks the gate 15 seconds before that timeout.
      </P>

      <H2 id="modes">Guard and Delegate mode</H2>
      <List>
        <li>
          <strong>Guard</strong> (default, recommended): Tollgate can only stop commands. After your
          team approves, Claude Code still asks you as usual.
        </li>
        <li>
          <strong>Delegate</strong>: your team&apos;s approval lets that exact command run without
          Claude Code asking again. Only the team owner can turn it on for a repo.
        </li>
      </List>

      <H2 id="roles">Roles</H2>
      <Table
        head={["Role", "Can"]}
        rows={[
          [
            "Owner",
            "Everything: approve, invite people, link repos, set Delegate mode, accept team rules",
          ],
          ["Approver", "Approve, deny and ask; link repos for their own machine"],
          ["Requester", "Raise gates from their agent; can't vote"],
          ["Client", "Approve, deny and ask from a link; doesn't receive team-only messages"],
        ]}
      />
      <Callout title="Nobody approves their own agent">
        Whatever the role, the person whose agent raised a gate can&apos;t vote on it.
      </Callout>

      <H2 id="rules">Team rules</H2>
      <P>
        When a kind of command in a repo has been approved every time (at least 10 decisions in 30
        days), Tollgate suggests a rule: one approval instead of two, or approve on arrival. The
        owner decides in <strong>Settings › Rules</strong>. Rules are never suggested for
        production, publishing, infrastructure, or deletes outside the repo.
      </P>
      <P>
        For a few hours rather than for good, an approver can{" "}
        <a
          href="/docs/approvers#decide"
          className="text-[#f2c14e] underline-offset-4 hover:underline"
        >
          approve for a while
        </a>{" "}
        instead: one teammate&apos;s agent, one kind of gate, 30 minutes to 4 hours, with the same
        limits as rules.
      </P>

      <H2 id="invites">Invites</H2>
      <List>
        <li>
          <strong>Settings › Invite people</strong> makes a link for teammates or clients, valid for
          72 hours and up to 10 people.
        </li>
        <li>
          <strong>Invite someone to decide</strong> on a waiting gate makes a link and QR code for
          one person, valid for 48 hours, that opens on that gate.
        </li>
        <li>
          Links can be revoked in Settings. <strong>Members</strong> shows whose invite each person
          joined through.
        </li>
      </List>

      <H2 id="ai">The Why? explanation</H2>
      <P>
        <strong>Settings › AI explanations</strong>: the built-in explanations are free and nothing
        leaves the server. You can also connect your own AI provider. Either way it only explains;
        it never approves.
      </P>

      <H2 id="notifications">Notifications</H2>
      <List>
        <li>
          <strong>Turn on alerts</strong> in the room for browser and phone notifications about
          gates.
        </li>
        <li>
          The bell menu in the room sets how the team&apos;s chat notifies you: every message, only
          @mentions, or nothing. Gates notify you whatever you choose.
        </li>
      </List>

      <PrevNext href="/docs/configuration" />
    </article>
  );
}
