import type { Metadata } from "next";
import {
  C,
  Callout,
  DocTitle,
  H2,
  H3,
  List,
  P,
  PrevNext,
  Table,
} from "@/features/docs/components/doc";

export const metadata: Metadata = {
  title: "For approvers · Tollgate docs",
  description:
    "How to read a Tollgate gate card and decide it: approve, deny with a reason, or ask.",
};

export default function ApproversPage() {
  return (
    <article>
      <DocTitle href="/docs/approvers" />

      <P>
        You approve for a team whose AI coding agents ask before risky commands. There&apos;s
        nothing to install: you decide from the team&apos;s room in the browser, on a laptop or a
        phone.
      </P>

      <H2 id="notified">How you hear about a gate</H2>
      <List>
        <li>The card appears live in the team&apos;s room.</li>
        <li>
          Your phone or browser notifies you, once you&apos;ve pressed{" "}
          <strong>Turn on alerts</strong> in the room.
        </li>
        <li>An email arrives as a backup.</li>
      </List>

      <H2 id="card">Reading a gate card</H2>
      <Table
        head={["On the card", "What it tells you"]}
        rows={[
          [
            <strong key="c">TG-17</strong>,
            "The gate's number in your team. Every gate is on record.",
          ],
          [
            "Kind and place",
            "What sort of command (migration, deploy, publish…) and whether it targets production.",
          ],
          [
            "The agent's reason",
            "The agent's own description of what it's doing. A claim, not a fact.",
          ],
          ["The command", "Exactly what will run, with secrets already hidden."],
          [
            "Runs",
            "What a package script or wrapper really runs, e.g. pnpm db:deploy → prisma migrate deploy.",
          ],
          ["Context", "Extra detail, such as the migration's SQL."],
          ["Warnings", "Plain-language risks read from the command, like dropping a column."],
          ["Decided before", "What your team did the last time it saw something like this."],
          [
            <strong key="w">Why?</strong>,
            "A plain-language explanation of the command. It never approves or recommends.",
          ],
          ["Parks in 3:12", "How long the agent will keep waiting before it moves on."],
          ["Seen by", "Who else has looked at it so far."],
        ]}
      />

      <H2 id="decide">Deciding</H2>
      <H3>Approve</H3>
      <P>
        Press <strong>Approve</strong>. Add a one-line note first if it helps the rest of the team
        (&ldquo;rename + backfill looks right&rdquo;). Production and high-risk gates ask you to{" "}
        <strong>press and hold</strong> Approve for a second, so they can&apos;t be approved by a
        stray tap. Some gates need two approvals, shown as <C>0/2</C>.
      </P>
      <H3>Deny with a reason</H3>
      <P>
        Press <strong>Deny…</strong> and say what the agent should do instead. Your reason reaches
        the agent word for word as its next instruction, so a good reason gets a better plan.
        Secrets in it are hidden before the agent sees it.
      </P>
      <H3>Ask the agent first</H3>
      <P>
        Not sure? Press <strong>Ask…</strong> and type a question. The gate closes, the agent
        answers in its next attempt, and your team decides that new gate with the answer on it. Ask
        is only offered while the agent is still waiting.
      </P>

      <H2 id="talk">Talking it through</H2>
      <List>
        <li>
          <strong>Reply</strong> on a card to discuss that gate. Replies show on the card, and any
          of them can become the deny reason.
        </li>
        <li>
          Type <C>@</C> to mention someone: they get a push, and you see when they&apos;ve read it.
        </li>
        <li>
          Teams with clients can send <strong>team-only</strong> messages (the lock button) that
          clients never receive.
        </li>
        <li>Translate a message into your language from its menu.</li>
      </List>

      <H2 id="parked">When the agent stops waiting</H2>
      <P>
        An agent waits about five minutes by default. If nobody decides in time, the gate{" "}
        <strong>parks</strong> and the agent moves on to other work. You can still approve a parked
        gate: when the agent retries the exact same command within 24 hours, it passes, once.
      </P>

      <H2 id="review">Clearing a queue</H2>
      <P>
        <strong>Review</strong> shows waiting gates one at a time, oldest first. Use <C>J</C>/
        <C>K</C> to move, <C>A</C> to approve and <C>D</C> to deny.
      </P>

      <Callout title="Clients">
        Client accounts approve and deny like teammates. They don&apos;t receive team-only messages.
      </Callout>

      <PrevNext href="/docs/approvers" />
    </article>
  );
}
