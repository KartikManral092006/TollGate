import { TOOL_NOUN, type GateTool } from "@/features/gates/shared/presets";
import { commandShape } from "./precedent";
import type { HistoryGate, RiskSignal } from "./types";

// Short warnings on a waiting gate, each with its reason, so the risky part is visible before
// anyone opens Context or asks "Why?". Signals, not a verdict: there is deliberately no score
// and no recommendation, because a number invites approving on trust.

const MAX_SIGNALS = 3;
const RETRY_WINDOW_MS = 60 * 60 * 1000;
// "First time" only means something once a repo has some history.
const FIRST_TIME_MIN_HISTORY = 5;

export type Rule = { id: string; pattern: RegExp; text: string };

// Statements that destroy data, read from migration SQL and from the command itself.
export const DATA_LOSS: Rule[] = [
  { id: "drop-table", pattern: /\bDROP\s+TABLE\b/i, text: "Drops a table and every row in it" },
  {
    id: "drop-column",
    pattern: /\bDROP\s+COLUMN\b/i,
    text: "Drops a column and every value in it",
  },
  { id: "truncate", pattern: /\bTRUNCATE\b/i, text: "Empties a table" },
  {
    id: "delete-all",
    pattern: /\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)/i,
    text: "Deletes every row in a table (no WHERE)",
  },
  { id: "drop-database", pattern: /\bDROP\s+(DATABASE|SCHEMA)\b/i, text: "Drops a whole database" },
];

const COMMAND_RISKS: (Rule & { level: RiskSignal["level"] })[] = [
  {
    id: "db-reset",
    level: "high",
    pattern: /\bprisma\s+migrate\s+reset\b/i,
    text: "Wipes the database and rebuilds it from scratch",
  },
  {
    id: "accept-data-loss",
    level: "high",
    pattern: /--accept-data-loss\b/i,
    text: "Tells the tool to accept data loss",
  },
  {
    id: "destroy-stack",
    level: "high",
    pattern: /\b(terraform|pulumi)\s+destroy\b/i,
    text: "Destroys every resource in the stack",
  },
  {
    id: "s3-recursive",
    level: "high",
    pattern: /\baws\s+s3\s+(rm|rb)\b.*--recursive\b|\baws\s+s3\s+rb\b.*--force\b/i,
    text: "Deletes everything under an S3 path",
  },
  {
    id: "skip-confirm",
    level: "medium",
    pattern: /(^|\s)(-auto-approve|--auto-approve|--yes|--force)(\s|=|$)/i,
    text: "Skips the tool's own confirmation",
  },
];

const MAIN_BRANCH = /^(main|master|trunk|prod|production|release([/-].*)?|HEAD)$/i;
const NON_PROD_WORDS = /\b(staging|stage|dev|development|test|testing|local|sandbox|preview)\b/i;
const PROD_WORDS = /\bprod(uction)?\b/i;
const DRY_RUN_CLAIM = /\bdry[- ]?run\b/i;
const DRY_RUN_FLAG = /(^|\s)--dry-?run\b|\bterraform\s+plan\b|\bpulumi\s+preview\b/i;

export type SignalInput = {
  id: string;
  repo: string;
  preset: string;
  tool?: GateTool;
  env: string;
  command: string;
  context: string;
  intent: string | null;
  via?: string | null;
  branch: string | null;
  createdAt: string;
  requester: { id: string };
};

export function riskSignals(gate: SignalInput, history: HistoryGate[]): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const add = (signal: RiskSignal) => {
    if (!signals.some((s) => s.id === signal.id)) signals.push(signal);
  };

  // Migration SQL only counts for migrations: other presets' context is a commit message.
  const sql = gate.preset === "db-migrate" ? `${gate.command}\n${gate.context}` : gate.command;
  for (const rule of DATA_LOSS) {
    if (rule.pattern.test(sql)) add({ id: rule.id, level: "high", text: rule.text });
  }
  for (const rule of COMMAND_RISKS) {
    if (rule.pattern.test(gate.command)) add({ id: rule.id, level: rule.level, text: rule.text });
  }

  // The agent's description is its claim; flag it when it contradicts the command.
  if (gate.intent) {
    const word = gate.intent.match(NON_PROD_WORDS)?.[0];
    if (gate.env === "prod" && word && !PROD_WORDS.test(gate.intent)) {
      add({
        id: "intent-env",
        level: "high",
        text: `The agent says "${word.toLowerCase()}", but this targets production`,
      });
    }
    if (DRY_RUN_CLAIM.test(gate.intent) && !DRY_RUN_FLAG.test(gate.command)) {
      add({
        id: "intent-dry-run",
        level: "high",
        text: "The agent calls this a dry run, but the command isn't one",
      });
    }
  }

  // The risky part was inside a package script or wrapper, not typed directly.
  const from = gate.via?.split("\n")[0]?.split(" → ")[0];
  if (from) {
    add({
      id: "hidden-in-script",
      level: "medium",
      text: `Runs inside ${from}, not typed directly`,
    });
  }

  if (gate.env === "prod" && gate.branch && !MAIN_BRANCH.test(gate.branch)) {
    add({
      id: "prod-branch",
      level: "medium",
      text: `Production from branch ${gate.branch}, not main`,
    });
  }

  const shape = commandShape(gate.command);
  const noun = TOOL_NOUN[gate.tool ?? "bash"];
  const created = Date.parse(gate.createdAt);
  const earlier = history.filter((h) => Date.parse(h.createdAt) < created && h.id !== gate.id);

  // An agent that keeps retrying a denied command may be ignoring the team's reason.
  const deniedRetries = earlier.filter(
    (h) =>
      h.status === "denied" &&
      h.requesterId === gate.requester.id &&
      created - Date.parse(h.createdAt) <= RETRY_WINDOW_MS &&
      commandShape(h.command) === shape,
  ).length;
  if (deniedRetries > 0) {
    add({
      id: "retry-after-deny",
      level: "high",
      text:
        deniedRetries === 1
          ? `Same ${noun} was denied in the last hour`
          : `Same ${noun} was denied ${deniedRetries} times in the last hour`,
    });
  }

  const repoHistory = earlier.filter((h) => h.repo === gate.repo);
  if (
    repoHistory.length >= FIRST_TIME_MIN_HISTORY &&
    !repoHistory.some((h) => commandShape(h.command) === shape)
  ) {
    add({
      id: "first-time",
      level: "medium",
      text: `First time this ${noun} has come through ${gate.repo}`,
    });
  }

  const order = { high: 0, medium: 1 };
  return signals.sort((a, b) => order[a.level] - order[b.level]).slice(0, MAX_SIGNALS);
}
