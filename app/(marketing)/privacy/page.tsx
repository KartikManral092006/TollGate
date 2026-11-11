import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, List, P, Table } from "@/features/docs/components/doc";
import {
  ContactLink,
  LegalPage,
  Section,
  type LegalSection,
} from "@/features/legal/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · Tollgate",
  description:
    "What Tollgate collects, why, who processes it, how long it's kept, and how to have it deleted.",
};

const SECTIONS = [
  { id: "who", title: "Who we are" },
  { id: "collect", title: "What we collect" },
  { id: "not-collect", title: "What we don't collect" },
  { id: "use", title: "How we use it" },
  { id: "share", title: "Who else processes it" },
  { id: "team", title: "What your team can see" },
  { id: "retention", title: "How long we keep it" },
  { id: "cookies", title: "Cookies and browser storage" },
  { id: "choices", title: "Your choices and rights" },
  { id: "security", title: "Security" },
  { id: "transfers", title: "Where your data is processed" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact" },
] as const satisfies LegalSection[];

const at = (id: (typeof SECTIONS)[number]["id"]) => {
  const index = SECTIONS.findIndex((section) => section.id === id);
  return { section: SECTIONS[index]!, number: index + 1 };
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy Policy"
      intro={
        <p>
          Tollgate stops risky commands from AI coding agents until your team decides. To do that it
          has to see those commands. This page explains exactly what it sees, what it keeps, and
          what it never touches.
        </p>
      }
      summary={[
        "Commands that don't match a gate never leave your machine. Gated ones have secrets removed on your machine, and again on our server, before anything is stored.",
        "We use your data only to run Tollgate: showing gates to your team, sending sign-in links and notifications, and keeping your team's audit log.",
        "No ads, no tracking or analytics cookies, and we never sell your data.",
        "A handful of services help run Tollgate (hosting, database, chat, email, and AI explanations if your team uses them). They're all listed below.",
        <>
          You can ask for a copy of your data or to have it deleted at any time: <ContactLink />.
        </>,
      ]}
      sections={SECTIONS}
    >
      <Section {...at("who")}>
        <P>
          Tollgate is built and run by Kartik Manral, an independent developer (&quot;we&quot;,
          &quot;us&quot;). This policy covers the Tollgate website and web app, and the{" "}
          <C>tollgate-cli</C> hook you install for Claude Code. Tollgate is currently a free beta.
        </P>
      </Section>

      <Section {...at("collect")}>
        <P>
          <strong className="text-white">Your account.</strong> Your name, email address, profile
          picture (if you sign in with GitHub) and preferred language. If you sign in with GitHub,
          GitHub shares your public profile and email address with us. Tollgate never asks for
          access to your repositories.
        </P>
        <P>
          <strong className="text-white">Sign-in sessions.</strong> A session record with the IP
          address and browser it was created from, so you stay signed in and we can spot misuse.
          Sign-in links you request by email are single-use and expire after 10 minutes.
        </P>
        <P>
          <strong className="text-white">Your team.</strong> Team names, who belongs to each team,
          their roles, who invited whom, the repositories you link (by name, such as{" "}
          <C>acme/billing</C>), and team rules and approval windows. Invite links and hook tokens
          are stored only as one-way hashes, so we can check them but can&apos;t read them back.
        </P>
        <P>
          <strong className="text-white">Gates.</strong> When your agent tries something that
          matches one of your team&apos;s gates, <C>tollgate-cli</C> sends:
        </P>
        <List>
          <li>the command with secrets removed, the folder it runs in, and the git branch</li>
          <li>short context, such as a migration&apos;s SQL</li>
          <li>the reason the agent gave, and its Claude Code session id</li>
          <li>
            for a file edit, the file path and the change; for an MCP call, the tool and its
            arguments
          </li>
        </List>
        <P>
          We then store what happens to each gate: who approved, denied or asked a question, their
          reasons and notes, who looked at it, and when.
        </P>
        <P>
          <strong className="text-white">Your team room.</strong> Chat messages, pictures and files
          you send, @mentions, read receipts, and replies on gates. These travel through and are
          stored by Nexconn, our real-time messaging provider.
        </P>
        <P>
          <strong className="text-white">Calls.</strong> If your team uses audio calls on a gate, we
          record who started and joined the call and how long it lasted. Tollgate doesn&apos;t
          record call audio.
        </P>
        <P>
          <strong className="text-white">Your team&apos;s AI settings.</strong> If your team
          connects its own AI provider for &quot;Why?&quot; explanations, we store the provider
          address, the model name and the API key. The key is encrypted at rest and never sent back
          to anyone&apos;s browser; only its last four characters are shown.
        </P>
        <P>
          <strong className="text-white">Short-lived technical data.</strong> Counters for rate
          limits (keyed by your account, a hook token or, for sign-in, an IP address), which gate
          you&apos;re looking at and whether you&apos;re typing (so teammates see who&apos;s there),
          and error logs. Our hosting provider also keeps standard request logs.
        </P>
      </Section>

      <Section {...at("not-collect")}>
        <List>
          <li>
            Commands, edits and tool calls that don&apos;t match a gate. The check happens on your
            machine, and nothing about them is sent.
          </li>
          <li>
            Secrets, as far as we can detect them. Private keys, passwords in URLs, cloud and API
            keys and tokens, JWTs, <C>PASSWORD=</C>-style values and every value in your <C>.env</C>{" "}
            files are removed on your machine, and removed again on our server.
          </li>
          <li>Your code, beyond the gated change itself.</li>
          <li>Payment details. Tollgate is free during the beta.</li>
          <li>Advertising or analytics data. There are no tracking scripts or ad cookies.</li>
        </List>
        <Callout tone="warn" title="Secret removal is pattern-based">
          It catches the common formats listed above, but it can&apos;t recognise every secret.
          Avoid putting secrets in commands, chat messages or deny reasons where you can.
        </Callout>
      </Section>

      <Section {...at("use")}>
        <List>
          <li>
            To run Tollgate: show gates to your team, record decisions, and tell the agent the
            result.
          </li>
          <li>
            To send you email you need: sign-in links, a gate waiting on you, a decision on your
            gate, and reminders about gates still waiting. No marketing email.
          </li>
          <li>
            To give your team insights from its own history, such as an earlier decision on the same
            command, who usually decides a gate, and suggested team rules. These come only from your
            own team&apos;s data and are shown only to your team.
          </li>
          <li>To explain a gate with &quot;Why?&quot;, if your team uses it (see below).</li>
          <li>
            To keep Tollgate secure and working: rate limits, abuse prevention and fixing errors.
          </li>
        </List>
        <P>We don&apos;t sell your data, and we don&apos;t use it to train AI models.</P>
      </Section>

      <Section {...at("share")}>
        <P>
          These services process data for us, only to run Tollgate. Each has its own privacy policy.
        </P>
        <Table
          head={["Service", "What it does", "What it receives"]}
          rows={[
            [
              "Vercel",
              "Hosts the website and app",
              "Every request to Tollgate, including IP address",
            ],
            ["Neon", "Database", "Accounts, teams, gates and decisions"],
            [
              "Upstash",
              "Fast temporary storage",
              "Rate-limit counters, who's in the room, cached explanations",
            ],
            [
              "Nexconn",
              "Real-time team room",
              "Your name, chat messages, files, gate cards, translations and calls",
            ],
            ["Resend", "Email delivery", "Your email address and the email's contents"],
            ["GitHub", "Sign-in, if you choose it", "That you're signing in to Tollgate"],
            [
              "Anthropic, or your team's own AI provider",
              "“Why?” explanations",
              "The gated command (secrets already removed), its context, the agent's reason, the repository name and the gate's rule",
            ],
          ]}
        />
        <P>
          Translating a chat message is done by Nexconn, only when you ask for it. If your team
          connects its own AI provider, that provider receives the data listed above under its own
          terms, and your team chooses it.
        </P>
        <P>
          We may also disclose data if the law requires it, or to protect Tollgate&apos;s users or
          the service from harm. We&apos;ll tell affected users where we&apos;re allowed to.
        </P>
      </Section>

      <Section {...at("team")}>
        <P>
          Everyone on a team can see that team&apos;s gates, decisions and room, and who else is in
          it. Messages marked team-only aren&apos;t shown to the team&apos;s guests, such as
          clients. People who aren&apos;t on a team can&apos;t see anything of it. If someone
          invites you to decide a single gate, the invite link shows a preview of that gate before
          you sign in.
        </P>
      </Section>

      <Section {...at("retention")}>
        <Table
          head={["Data", "Kept for"]}
          rows={[
            ["Your account", "Until you ask us to delete it"],
            [
              "Gates, decisions and the audit log",
              "As long as the team exists, unless you ask us to delete them",
            ],
            ["Chat messages and files", "Stored by Nexconn while the team's room exists"],
            ["Sign-in sessions", "30 days from your last sign-in or refresh"],
            ["Sign-in links", "10 minutes, used once"],
            ["Single-gate invite links", "48 hours"],
            ["“Why?” explanations", "Cached for 7 days"],
            ["Who's in the room and typing", "About 2 minutes"],
            ["Rate-limit counters", "From a minute to a day, depending on the limit"],
          ]}
        />
        <P>
          Tollgate doesn&apos;t delete old gates automatically yet: the audit log is one of the
          things it&apos;s for. If you want older history removed, ask us.
        </P>
      </Section>

      <Section {...at("cookies")}>
        <P>
          Tollgate sets one cookie: your sign-in session, which keeps you signed in. It&apos;s
          essential, so there&apos;s no consent banner. It also stores a few preferences in your
          browser, such as your theme and whether you closed the setup guide. There are no
          advertising or analytics cookies.
        </P>
      </Section>

      <Section {...at("choices")}>
        <P>Wherever you live, you can:</P>
        <List>
          <li>ask for a copy of the personal data we hold about you</li>
          <li>ask us to correct it</li>
          <li>ask us to delete your account and your personal data</li>
          <li>withdraw from Tollgate at any time</li>
        </List>
        <P>
          Write to <ContactLink /> and we&apos;ll reply within 30 days. Gates and decisions are part
          of your team&apos;s shared audit log, so when you delete your account we remove or
          anonymise your personal details in them.
        </P>
        <P>You can also do some of this yourself:</P>
        <List>
          <li>
            Revoke a hook token in your team&apos;s <strong className="text-white">Settings</strong>
            . It stops working at once.
          </li>
          <li>
            Switch &quot;Why?&quot; back to the built-in explanation in{" "}
            <strong className="text-white">Settings</strong>. That deletes your team&apos;s stored
            AI key.
          </li>
          <li>
            Remove the hook from a repository by deleting the Tollgate entry from{" "}
            <C>.claude/settings.local.json</C>. Then nothing is sent from that repository.
          </li>
        </List>
      </Section>

      <Section {...at("security")}>
        <P>
          Everything travels over HTTPS. Hook tokens and invite links are stored only as hashes,
          your team&apos;s AI key is encrypted, every API route is rate-limited, and secrets are
          removed before storage. No system is perfectly secure, though. If you find a security
          problem, please report it privately to <ContactLink /> instead of opening a public issue.
        </P>
      </Section>

      <Section {...at("transfers")}>
        <P>
          Tollgate&apos;s app servers run in Singapore, and the services listed above may process
          data in other countries. Wherever your data is processed, we handle it as this policy
          describes.
        </P>
      </Section>

      <Section {...at("children")}>
        <P>
          Tollgate is a tool for software teams and isn&apos;t meant for anyone under 18. If you
          believe a child has given us personal data, contact us and we&apos;ll delete it.
        </P>
      </Section>

      <Section {...at("changes")}>
        <P>
          If we change this policy, we&apos;ll update the date at the top. For significant changes,
          we&apos;ll also tell you in the app or by email before they take effect.
        </P>
      </Section>

      <Section {...at("contact")}>
        <P>
          Questions, requests or concerns about your data: <ContactLink />. See also our{" "}
          <Link
            href="/terms"
            className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            Terms of Service
          </Link>
          .
        </P>
      </Section>
    </LegalPage>
  );
}
