"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gateMetrics, gatesToCsv } from "@/features/gates/shared/metrics";
import type { GateStatusView, GateView } from "@/features/gates/shared/view";
import { EnvBadge, StatusChip } from "@/features/room/components/gate-status";
import { clockTime, timeAgo } from "@/features/room/shared/format";

type Filter = "all" | "open" | GateStatusView;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
];

function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

function duration(sec: number | null): string {
  if (sec === null) return "–";
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-3" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function decider(gate: GateView): string {
  if (gate.status === "denied") return gate.votes.find((v) => v.decision === "deny")?.name ?? "–";
  if (gate.status === "approved") {
    return (
      gate.votes
        .filter((v) => v.decision === "approve")
        .map((v) => v.name)
        .join(", ") || "–"
    );
  }
  return "–";
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
  const metrics = useMemo(() => gateMetrics(gates), [gates]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return gates
      .filter((g) =>
        filter === "all"
          ? true
          : filter === "open"
            ? g.status === "pending" || g.status === "parked"
            : g.status === filter,
      )
      .filter((g) =>
        needle
          ? [`tg-${g.code}`, g.command, g.repo, g.preset, g.requester.name, g.denyReason ?? ""]
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-3 py-5 sm:px-4">
      <section aria-label="Team metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Gates"
          value={String(metrics.total)}
          hint="Every risky command raised by this team's agents"
        />
        <Stat
          label="Median decision"
          value={duration(metrics.medianDecisionSec)}
          hint="Time from the gate appearing to its approval or denial"
        />
        <Stat
          label="Denied"
          value={percent(metrics.denyRate)}
          hint="Share of decided gates the team denied"
        />
        <Stat
          label="Rubber-stamped"
          value={percent(metrics.rubberStampRate)}
          hint="Approvals given within 3 seconds of the gate appearing"
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          value={[filter]}
          onValueChange={(value: string[]) => value[0] && setFilter(value[0] as Filter)}
          variant="outline"
          size="sm"
          className="flex-wrap"
          aria-label="Filter by status"
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <InputGroup className="sm:ms-auto sm:w-64">
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
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download /> CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {gates.length === 0 ? "Nothing to audit yet" : "No gates match"}
            </EmptyTitle>
            <EmptyDescription>
              {gates.length === 0
                ? "Every gate your team decides lands here with who decided, why and when."
                : "Try another filter or search."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map((gate) => (
              <li key={gate.id}>
                <Link
                  href={`/teams/${teamId}?gate=${gate.id}`}
                  className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">TG-{gate.code}</span>
                    <EnvBadge env={gate.env} />
                    <StatusChip status={gate.status} className="ms-auto" />
                  </span>
                  <code className="truncate font-mono text-xs">{gate.command}</code>
                  <span className="text-xs text-muted-foreground">
                    {gate.requester.name} · {timeAgo(gate.createdAt)}
                    {gate.status === "approved" || gate.status === "denied"
                      ? ` · ${gate.status} by ${decider(gate)}`
                      : ""}
                  </span>
                  {gate.denyReason && (
                    <span className="text-xs text-gate-denied-fg">“{gate.denyReason}”</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Gate</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-end">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((gate) => (
                  <TableRow key={gate.id}>
                    <TableCell className="align-top">
                      <Link
                        href={`/teams/${teamId}?gate=${gate.id}`}
                        className="font-mono font-semibold underline-offset-4 hover:underline"
                      >
                        TG-{gate.code}
                      </Link>
                      <div className="mt-1">
                        <EnvBadge env={gate.env} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-72 align-top">
                      <code className="line-clamp-2 font-mono text-xs break-all whitespace-normal">
                        {gate.command}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {gate.repo} · {gate.preset}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">{gate.requester.name}</TableCell>
                    <TableCell className="max-w-64 align-top whitespace-normal">
                      <StatusChip status={gate.status} />
                      {(gate.status === "approved" || gate.status === "denied") && (
                        <p className="mt-1 text-xs text-muted-foreground">by {decider(gate)}</p>
                      )}
                      {gate.denyReason && (
                        <p className="mt-1 text-xs text-gate-denied-fg">“{gate.denyReason}”</p>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-end align-top text-xs text-muted-foreground"
                      title={new Date(gate.createdAt).toLocaleString()}
                    >
                      {timeAgo(gate.createdAt)}
                      <br />
                      {clockTime(gate.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </main>
  );
}
