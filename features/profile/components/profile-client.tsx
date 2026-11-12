"use client";

import { Bot, ChevronRight, CircleCheck, CircleX, TrafficCone } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Section } from "@/components/shell/section";
import { Button } from "@/components/ui/button";
import {
  LinkedMachines,
  NameEditor,
  SignedInBrowsers,
} from "@/features/profile/components/account-cards";
import { ActivityCalendar } from "@/features/profile/components/activity-calendar";
import {
  profileStats,
  timeline,
  topCounts,
  type ProfileView,
  type TimelineItem,
} from "@/features/profile/shared/profile";
import { STATUS } from "@/features/room/components/gate-status";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86_400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86_400).toFixed(1)} days`;
}

const asCount = (n: number) => String(Math.round(n));
const asPercent = (n: number) => `${Math.round(n * 100)}%`;

function Stat({
  label,
  value,
  format,
  hint,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b py-5 odd:pe-4 even:ps-4 lg:border-b-0 lg:px-8 lg:first:ps-0 lg:odd:pe-8 lg:even:ps-8">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl leading-none font-extrabold tracking-tight tabular-nums">
        {value === null ? "–" : <NumberTicker value={value} format={format} />}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

// A ranked list with bars that grow in as it scrolls into view.
function BarList({
  items,
  mono = false,
}: {
  items: { label: string; count: number }[];
  mono?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={item.label} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className={cn("truncate", mono && "font-mono text-[13px]")}>{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.count}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.span
              className="block h-full rounded-full bg-signal"
              initial={{ width: 0 }}
              whileInView={{ width: `${(item.count / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.6, ease: [0.2, 0, 0, 1] }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineRow({
  item,
  isSelf,
  viewerId,
}: {
  item: TimelineItem;
  isSelf: boolean;
  viewerId: string;
}) {
  if (item.kind === "raised") {
    const { gate } = item;
    const status = STATUS[gate.status];
    return (
      <Link
        href={`/teams/${gate.teamId}/gates/${gate.id}`}
        className="group flex items-start gap-3 py-3 outline-none focus-visible:bg-muted"
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium transition-colors group-hover:text-primary">
              {isSelf ? "Your agent" : "Their agent"} raised TG-{gate.code}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 text-xs leading-5 font-semibold",
                status.chip,
              )}
            >
              <status.icon className="size-3" aria-hidden />
              {status.label}
            </span>
            <span className="text-xs text-muted-foreground">{gate.teamName}</span>
          </span>
          <code className="truncate rounded bg-asphalt px-2 py-1 font-mono text-xs text-white">
            <span className="text-white/45 select-none">❯ </span>
            {gate.command}
          </code>
        </span>
        <span className="shrink-0 pt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
          {timeAgo(gate.createdAt)}
        </span>
      </Link>
    );
  }

  const { vote } = item;
  const approved = vote.decision === "approve";
  const Icon = approved ? CircleCheck : CircleX;
  return (
    <Link
      href={`/teams/${vote.teamId}/gates/${vote.gateId}`}
      className="group flex items-start gap-3 py-3 outline-none focus-visible:bg-muted"
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          approved ? "bg-gate-approved-bg" : "bg-gate-denied-bg",
        )}
      >
        <Icon
          className={cn("size-4", approved ? "text-gate-approved-fg" : "text-gate-denied-fg")}
          aria-hidden
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium transition-colors group-hover:text-primary">
            {approved ? "Approved" : "Denied"}{" "}
            {vote.requester.id === viewerId ? "your" : `${vote.requester.name}'s`} TG-
            {vote.gateCode}
          </span>
          <span className="text-xs text-muted-foreground">{vote.teamName}</span>
        </span>
        <code className="truncate font-mono text-xs text-muted-foreground">{vote.command}</code>
        {vote.reason && <span className="text-sm text-muted-foreground">“{vote.reason}”</span>}
      </span>
      <span className="shrink-0 pt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
        {timeAgo(vote.at)}
      </span>
    </Link>
  );
}

const PAGE = 12;

export function ProfileClient({ profile }: { profile: ProfileView }) {
  const { user, isSelf, teams, gates, votes } = profile;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const stats = useMemo(() => profileStats(gates, votes), [gates, votes]);
  const times = useMemo(
    () => [...gates.map((g) => Date.parse(g.createdAt)), ...votes.map((v) => Date.parse(v.at))],
    [gates, votes],
  );
  const items = useMemo(() => timeline(gates, votes, 200), [gates, votes]);
  const presets = useMemo(() => topCounts(gates.map((g) => g.preset)), [gates]);
  const repos = useMemo(() => topCounts(gates.map((g) => g.repo)), [gates]);
  const [shown, setShown] = useState(PAGE);
  const empty = gates.length === 0 && votes.length === 0;
  const memberSince = new Date(user.memberSince).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* A highway sign: green plate, white inset border, white lettering. */}
      <header className="border-b px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="rounded-xl bg-[#00704a] p-1.5 text-white shadow-sm"
        >
          <div className="flex flex-col gap-4 rounded-lg border-2 border-white/85 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
            <PersonAvatar
              id={user.id}
              name={user.name}
              size="lg"
              className="size-16 ring-2 ring-white data-[size=lg]:size-16"
              textClassName="text-xl"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl leading-tight font-extrabold tracking-tight lg:text-3xl">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-white/80">
                <span suppressHydrationWarning>On Tollgate since {memberSince}</span>
                {user.email && (
                  <span className="block truncate sm:inline">
                    <span className="hidden sm:inline">, </span>
                    {user.email}
                  </span>
                )}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Teams">
                {teams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-xs leading-6 font-semibold transition-colors outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {team.name}
                      <span className="font-normal text-white/75">
                        {ROLE_LABEL[team.role] ?? team.role}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {isSelf && <NameEditor name={user.name} className="self-start sm:self-center" />}
          </div>
        </motion.div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-10">
        <dl className="grid grid-cols-2 border-b lg:grid-cols-4 lg:divide-x">
          <Stat
            label="Gates raised"
            value={stats.raised}
            format={asCount}
            hint={
              stats.raised > 0
                ? `${stats.raisedApproved} approved, ${stats.raisedDenied} denied`
                : undefined
            }
          />
          <Stat
            label="Reviews given"
            value={stats.reviews}
            format={asCount}
            hint={
              stats.reviews > 0 ? `${stats.approvals} approved, ${stats.denials} denied` : undefined
            }
          />
          <Stat label="Median response" value={stats.medianResponseSec} format={duration} />
          <Stat
            label="Quick approvals"
            value={stats.quickApprovalRate}
            format={asPercent}
            hint="Under 3 s"
          />
        </dl>

        {empty ? (
          <Section title="Nothing here yet">
            <div className="flex items-start gap-3 border-s-4 border-signal ps-4">
              <TrafficCone className="mt-0.5 size-5 shrink-0 text-signal" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {isSelf ? (
                  <>
                    Run <code className="font-mono text-foreground">npx -y tollgate-cli test</code>{" "}
                    in a linked repo to raise your first gate.
                  </>
                ) : (
                  `No gates or reviews from ${firstName} yet.`
                )}
              </p>
            </div>
          </Section>
        ) : (
          <>
            <Section title="Activity">
              <ActivityCalendar times={times} />
            </Section>

            {gates.length > 0 && (
              <Section title="Most gated">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Presets</h3>
                    <BarList items={presets} mono />
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Repos</h3>
                    <BarList items={repos} mono />
                  </div>
                </div>
              </Section>
            )}

            <Section title="Recent activity">
              <ul className="divide-y border-y">
                {items.slice(0, shown).map((item) => (
                  <li key={item.kind === "raised" ? `g${item.gate.id}` : `v${item.vote.gateId}`}>
                    <TimelineRow item={item} isSelf={isSelf} viewerId={profile.viewerId} />
                  </li>
                ))}
              </ul>
              {shown < items.length && (
                <Button variant="ghost" className="mt-3" onClick={() => setShown((n) => n + 20)}>
                  Show more
                  <ChevronRight />
                </Button>
              )}
              {profile.truncated && shown >= items.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Older activity is in each team&apos;s Audit log.
                </p>
              )}
            </Section>
          </>
        )}

        {profile.tokens && (
          <Section title="Linked machines" description="Only you can see this.">
            <LinkedMachines tokens={profile.tokens} />
          </Section>
        )}

        {profile.sessions && (
          <Section title="Signed-in browsers" description="Only you can see this.">
            <SignedInBrowsers sessions={profile.sessions} />
          </Section>
        )}
      </main>
    </>
  );
}
