"use client";

import { ArrowUpRight, ChevronRight, Download, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Sparkline } from "@/components/motion/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { dailySeries, gateMetrics, gatesToCsv } from "@/features/gates/shared/metrics";
import {
  displayStatus,
  type GateDisplayStatus,
  type GateStatusView,
  type GateView,
} from "@/features/gates/shared/view";
import { STATUS } from "@/features/room/components/gate-status";
import { useNow } from "@/features/room/components/park-countdown";
import { clockTime, timeAgo } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | GateStatusView;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
];

const DOT: Record<GateDisplayStatus, string> = {
  pending: "bg-gate-pending",
  asked: "bg-gate-pending",
  approved: "bg-gate-approved",
  denied: "bg-gate-denied",
  parked: "bg-gate-parked",
  expired: "bg-gate-parked",
};

function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

const asCount = (n: number) => String(Math.round(n));
const asPercent = (n: number) => `${Math.round(n * 100)}%`;
const asDuration = (sec: number) => duration(sec);

function matches(gate: GateView, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return gate.status === "pending" || gate.status === "parked";
  return gate.status === filter;
}

function decider(gate: GateView): string | null {
  if (gate.rule?.action === "auto_approve") return "a team rule";
  if (gate.status === "denied") return gate.votes.find((v) => v.decision === "deny")?.name ?? null;
  if (gate.status === "approved") {
    return (
      gate.votes
        .filter((v) => v.decision === "approve")
        .map((v) => v.name)
        .join(", ") || null
    );
  }
  return null;
}

function Stat({
  label,
  value,
  format,
  hint,
  trend,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  hint: string;
  trend: { values: (number | null)[]; days: string[] } | null;
}) {
  return (
    <div className="flex flex-col gap-1 py-5 lg:px-8 lg:first:ps-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl leading-none font-extrabold tracking-tight tabular-nums">
        {value === null ? "–" : <NumberTicker value={value} format={format} />}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {/* Drawn after hydration: the days depend on the viewer's clock and timezone. */}
      <div className="mt-2 h-8 max-w-48">
        {trend && (
          <Sparkline values={trend.values} days={trend.days} format={format} label={label} />
        )}
      </div>
    </div>
  );
}

function Outcome({ gate }: { gate: GateView }) {
  const shown = displayStatus(gate);
  const by = decider(gate);
  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-2 font-medium">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[shown])} />
        {STATUS[shown].label}
      </span>
      {by && <span className="ps-4 text-xs text-muted-foreground">by {by}</span>}
    </span>
  );
}

// Everything about one gate, opened under its row.
function Details({ gate, teamId }: { gate: GateView; teamId: string }) {
  return (
    <div className="grid gap-5 py-4 text-sm lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-3">
        <pre className="overflow-x-auto rounded-md bg-asphalt px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white">
          <span className="text-white/45 select-none">❯ </span>
          {gate.command}
        </pre>
        {gate.via && (
          <p className="font-mono text-xs text-muted-foreground">
            Really runs: <span className="text-foreground">{gate.via}</span>
          </p>
        )}
        {gate.intent && (
          <p>
            <span className="text-muted-foreground">The agent&apos;s reason: </span>
            &ldquo;{gate.intent}&rdquo;
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {gate.repo}
          {gate.branch ? ` on ${gate.branch}` : ""}, {gate.preset}, quorum {gate.quorum}
          {gate.redactions > 0
            ? `, ${gate.redactions} ${gate.redactions === 1 ? "secret" : "secrets"} hidden`
            : ""}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {gate.votes.length === 0 ? (
          <p className="text-muted-foreground">
            {gate.rule?.action === "auto_approve"
              ? "Approved on arrival by a team rule."
              : "No votes."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gate.votes.map((vote) => (
              <li key={vote.userId}>
                <span className="font-medium">{vote.name}</span>{" "}
                <span
                  className={
                    vote.decision === "approve" ? "text-gate-approved-fg" : "text-gate-denied-fg"
                  }
                >
                  {vote.decision === "approve" ? "approved" : gate.question ? "asked" : "denied"}
                </span>{" "}
                <span className="text-xs text-muted-foreground">{clockTime(vote.at)}</span>
                {vote.reason && (
                  <p className="text-muted-foreground">&ldquo;{vote.reason}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/teams/${teamId}/gates/${gate.id}`}
          className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Open in the room <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function AuditClient({
  teamId,
  teamName,
  gates,
}: {
  teamId: string;
  teamName: string;
  gates: GateView[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const metrics = useMemo(() => gateMetrics(gates), [gates]);
  const now = useNow(60_000);
  const series = useMemo(() => (now === null ? null : dailySeries(gates, now)), [gates, now]);
  const trend = (values: (number | null)[] | undefined) =>
    series && values ? { values, days: series.days } : null;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.value, gates.filter((g) => matches(g, f.value)).length]),
      ),
    [gates],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return gates
      .filter((g) => matches(g, filter))
      .filter((g) =>
        needle
          ? [
              `tg-${g.code}`,
              g.command,
              g.repo,
              g.preset,
              g.requester.name,
              g.denyReason ?? "",
              g.intent ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [gates, filter, query]);

  function exportCsv() {
    const blob = new Blob([`﻿${gatesToCsv(rows)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tollgate-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-audit.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Every gate in ${teamName}: who decided, why, and how fast.`}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 border-b px-4 sm:px-6 lg:grid-cols-4 lg:divide-x lg:px-10">
        <Stat
          label="Gates"
          value={metrics.total}
          format={asCount}
          hint="Risky commands raised"
          trend={trend(series?.gates)}
        />
        <Stat
          label="Median decision"
          value={metrics.medianDecisionSec}
          format={asDuration}
          hint="From gate to yes or no"
          trend={trend(series?.medianDecisionSec)}
        />
        <Stat
          label="Denied"
          value={metrics.denyRate}
          format={asPercent}
          hint="Of the gates people decided"
          trend={trend(series?.denyRate)}
        />
        <Stat
          label="Rubber-stamped"
          value={metrics.rubberStampRate}
          format={asPercent}
          hint="Approved in under 3 seconds"
          trend={trend(series?.rubberStampRate)}
        />
      </div>

      {/* Filters stay in reach while scrolling a long log. */}
      <div className="sticky top-14 z-10 flex flex-col gap-2 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:top-0 lg:flex-row lg:items-center lg:px-10">
        <nav aria-label="Filter by status" className="-mx-1 overflow-x-auto">
          <ul className="flex gap-1 px-1">
            {FILTERS.map((option) => {
              const active = filter === option.value;
              return (
                <li key={option.value} className="relative">
                  <button
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:text-foreground",
                      active
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {counts[option.value]}
                    </span>
                  </button>
                  {active && (
                    <motion.span
                      layoutId="audit-filter"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                      className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <InputGroup className="mb-2 lg:ms-auto lg:mb-0 lg:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands, people, reasons"
            aria-label="Search"
          />
        </InputGroup>
      </div>

      <main className="flex-1 px-4 pb-16 sm:px-6 lg:px-10">
        {rows.length === 0 ? (
          <div className="py-16">
            <p className="font-semibold">
              {gates.length === 0 ? "Nothing to audit yet" : "No gates match"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {gates.length === 0
                ? "Every gate your team decides lands here with who decided, why and when."
                : "Try another filter or search."}
            </p>
          </div>
        ) : (
          <>
            {/* Phones: one row per gate, tap to open. */}
            <ul className="divide-y md:hidden">
              {rows.map((gate) => {
                const open = openId === gate.id;
                return (
                  <li key={gate.id}>
                    <button
                      type="button"
                      onClick={() => toggle(gate.id)}
                      aria-expanded={open}
                      className="flex w-full flex-col gap-1.5 py-3.5 text-start outline-none focus-visible:bg-muted"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-bold">TG-{gate.code}</span>
                        <span className="text-xs text-muted-foreground">{gate.env}</span>
                        <span className="ms-auto text-xs text-muted-foreground">
                          {timeAgo(gate.createdAt)}
                        </span>
                      </span>
                      <code className="truncate font-mono text-xs">{gate.command}</code>
                      <span className="text-sm">
                        <Outcome gate={gate} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <Details gate={gate} teamId={teamId} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {/* Wider screens: a table; click a row for the full record. */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-8 py-3 font-medium" aria-label="Expand" />
                  <th className="w-24 py-3 font-medium">Gate</th>
                  <th className="py-3 font-medium">Command</th>
                  <th className="w-44 py-3 font-medium">Requested by</th>
                  <th className="w-48 py-3 font-medium">Outcome</th>
                  <th className="w-28 py-3 text-end font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((gate, index) => {
                  const open = openId === gate.id;
                  return (
                    <Fragment key={gate.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.2 }}
                        onClick={() => toggle(gate.id)}
                        className={cn(
                          "cursor-pointer border-b align-top transition-colors hover:bg-muted/60",
                          open && "bg-muted/60",
                        )}
                      >
                        <td className="py-3.5">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} TG-${gate.code}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggle(gate.id);
                            }}
                            className="grid size-5 place-items-center rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ChevronRight
                              className={cn("size-4 transition-transform", open && "rotate-90")}
                            />
                          </button>
                        </td>
                        <td className="py-3.5">
                          <span className="font-mono font-bold">TG-{gate.code}</span>
                          <span className="block text-xs text-muted-foreground">{gate.env}</span>
                        </td>
                        <td className="max-w-0 py-3.5 pe-6">
                          <code className="block truncate font-mono text-xs">{gate.command}</code>
                          <span className="block truncate text-xs text-muted-foreground">
                            {gate.repo}, {gate.preset}
                          </span>
                        </td>
                        <td className="py-3.5 pe-4">{gate.requester.name}</td>
                        <td className="py-3.5 pe-4">
                          <Outcome gate={gate} />
                        </td>
                        <td
                          className="py-3.5 text-end text-xs text-muted-foreground"
                          title={new Date(gate.createdAt).toLocaleString()}
                        >
                          {timeAgo(gate.createdAt)}
                          <span className="block">{clockTime(gate.createdAt)}</span>
                        </td>
                      </motion.tr>
                      <AnimatePresence initial={false}>
                        {open && (
                          <tr className="border-b bg-muted/30">
                            <td />
                            <td colSpan={5} className="pe-4">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                                className="overflow-hidden"
                              >
                                <Details gate={gate} teamId={teamId} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </main>
    </>
  );
}
