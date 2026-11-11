import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, List, P } from "@/features/docs/components/doc";
import {
  ContactLink,
  LegalPage,
  Section,
  type LegalSection,
} from "@/features/legal/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · Tollgate",
  description:
    "The rules for using Tollgate: what it does and doesn't promise, your responsibilities, and ours.",
};

const SECTIONS = [
  { id: "agreement", title: "Agreeing to these terms" },
  { id: "safety-net", title: "What Tollgate is, and isn't" },
  { id: "beta", title: "A free beta" },
  { id: "account", title: "Your account and tokens" },
  { id: "teams", title: "Teams and decisions" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "content", title: "Your content" },
  { id: "third-parties", title: "Other services" },
  { id: "open-source", title: "Open source" },
  { id: "ending", title: "Suspension and ending" },
  { id: "warranty", title: "No warranty" },
  { id: "liability", title: "Limitation of liability" },
  { id: "law", title: "Governing law" },
  { id: "changes", title: "Changes to these terms" },
  { id: "contact", title: "Contact" },
] as const satisfies LegalSection[];

const at = (id: (typeof SECTIONS)[number]["id"]) => {
  const index = SECTIONS.findIndex((section) => section.id === id);
  return { section: SECTIONS[index]!, number: index + 1 };
};

const link = "text-white underline decoration-white/30 underline-offset-4 hover:decoration-white";

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of Service"
      intro={
        <p>
          The rules for using Tollgate, written to be read. By using the website, the app or{" "}
          <C>tollgate-cli</C>, you agree to them.
        </p>
      }
      summary={[
        "Tollgate is a safety net for AI coding agents, not a guarantee. You stay responsible for what your agent does and what your team approves.",
        "It's a free beta: it can change, have outages, or stop, and it comes without warranties.",
        "Keep your hook tokens and invite links private; anyone holding them can use them.",
        "Don't abuse it, attack it, or use it for anything illegal.",
        "Your commands, messages and files stay yours. You let us process them only to run Tollgate for your team.",
      ]}
      sections={SECTIONS}
    >
      <Section {...at("agreement")}>
        <P>
          These terms are an agreement between you and Kartik Manral, the independent developer who
          builds and runs Tollgate (&quot;we&quot;, &quot;us&quot;). If you use Tollgate for a
          company or another organisation, you confirm you&apos;re allowed to accept these terms for
          it. If you don&apos;t agree, please don&apos;t use Tollgate.
        </P>
        <P>
          Our{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>{" "}
          explains how we handle your data and is part of these terms.
        </P>
      </Section>

      <Section {...at("safety-net")}>
        <P>
          Tollgate pauses an AI coding agent before risky actions and asks your team to decide. It
          reduces risk; it doesn&apos;t remove it.
        </P>
        <List>
          <li>
            It only sees what passes through the Claude Code hook that <C>tollgate-cli</C> installs.
            Anything run another way, or after the hook is removed or switched off, isn&apos;t
            checked.
          </li>
          <li>
            It only stops actions that match your team&apos;s gates. A risky command written in a
            form it doesn&apos;t recognise can get through.
          </li>
          <li>
            An approval lets the action happen. In Delegate mode, an approved command runs without
            Claude Code asking you again.
          </li>
          <li>
            If Tollgate can&apos;t be reached, risky actions are blocked rather than allowed. That
            can hold up your work during an outage.
          </li>
        </List>
        <Callout tone="warn" title="You stay responsible">
          You&apos;re responsible for your agent, your systems, your data and your backups, and your
          team is responsible for what it approves. Keep the protections you already have, such as
          reviews, backups and least-privilege credentials.
        </Callout>
      </Section>

      <Section {...at("beta")}>
        <P>
          Tollgate is free while it&apos;s in beta. Features can change, limits can apply, and there
          may be interruptions or data loss. We don&apos;t promise any particular uptime. If we
          introduce paid plans later, we&apos;ll tell you before anything you use starts to cost
          money, and you&apos;ll never be charged without agreeing first.
        </P>
      </Section>

      <Section {...at("account")}>
        <List>
          <li>Give accurate details, and keep access to your email and GitHub account secure.</li>
          <li>
            Treat hook tokens like passwords. A token can raise gates for its repository, so revoke
            it in <strong className="text-white">Settings</strong> if it leaks.
          </li>
          <li>
            Invite links work for whoever has them until they expire or run out of uses. Share them
            only with the people you mean to invite.
          </li>
          <li>You&apos;re responsible for what happens under your account.</li>
        </List>
      </Section>

      <Section {...at("teams")}>
        <P>
          A team&apos;s owner controls who joins, the team&apos;s settings, its rules and its
          approval windows. Decisions on gates are made by your team&apos;s members, not by us.
          &quot;Why?&quot; explanations and suggestions are generated automatically, can be wrong,
          and never decide anything. Check them before you rely on them.
        </P>
      </Section>

      <Section {...at("acceptable-use")}>
        <P>Don&apos;t use Tollgate to:</P>
        <List>
          <li>break the law, or infringe anyone else&apos;s rights</li>
          <li>send malware, spam, or harassing or abusive content</li>
          <li>
            try to access other teams&apos; data, get around rate limits or security, or overload
            the service
          </li>
          <li>send invites or emails to people who haven&apos;t asked for them</li>
          <li>resell or rebrand the hosted service as your own</li>
        </List>
        <P>
          Testing Tollgate&apos;s security is welcome if you report what you find privately (see{" "}
          <Link href="/privacy#security" className={link}>
            Security
          </Link>
          ) and don&apos;t touch other people&apos;s data.
        </P>
      </Section>

      <Section {...at("content")}>
        <P>
          You keep all rights to what you and your agent send to Tollgate: commands, messages, files
          and reasons. You give us permission to store, process, show and transmit it, including
          through the services named in the Privacy Policy, only as needed to run Tollgate for you
          and your team. You confirm you have the right to share it.
        </P>
      </Section>

      <Section {...at("third-parties")}>
        <P>
          Tollgate works with services we don&apos;t control, including Claude Code, GitHub, Nexconn
          and AI providers. Their own terms apply when you use them. If your team connects its own
          AI provider, its terms and any costs are between your team and that provider.
        </P>
      </Section>

      <Section {...at("open-source")}>
        <P>
          Tollgate&apos;s source code is public on GitHub, and <C>tollgate-cli</C> is published
          under the MIT licence. That licence governs the code itself; these terms govern the hosted
          service at this website.
        </P>
      </Section>

      <Section {...at("ending")}>
        <P>
          You can stop using Tollgate at any time. Remove the hook and ask us to delete your account
          if you want your data gone. We may suspend or close an account that breaks these terms or
          puts the service or other users at risk, with notice where that&apos;s reasonable. We may
          also end the service. If we do, we&apos;ll give notice where we can, so you have time to
          remove the hook.
        </P>
      </Section>

      <Section {...at("warranty")}>
        <P>
          Tollgate is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of
          any kind, as far as the law allows. That includes any warranty that it will catch every
          risky action, be available at any given time, or be free of errors.
        </P>
      </Section>

      <Section {...at("liability")}>
        <P>
          As far as the law allows, we&apos;re not liable for indirect or consequential losses, or
          for lost data, profits or business, including losses from an action Tollgate didn&apos;t
          stop, an action your team approved, or work held up while Tollgate was unavailable. Our
          total liability for any claim is limited to what you paid us for Tollgate in the 12 months
          before it. During the free beta, that&apos;s nothing. Nothing in these terms limits
          liability that the law doesn&apos;t allow us to limit.
        </P>
      </Section>

      <Section {...at("law")}>
        <P>These terms are governed by the laws of India.</P>
      </Section>

      <Section {...at("changes")}>
        <P>
          We may update these terms as Tollgate changes. We&apos;ll update the date at the top, and
          for significant changes we&apos;ll tell you in the app or by email before they take
          effect. If you keep using Tollgate after that, the new terms apply.
        </P>
      </Section>

      <Section {...at("contact")}>
        <P>
          Questions about these terms: <ContactLink />.
        </P>
      </Section>
    </LegalPage>
  );
}
