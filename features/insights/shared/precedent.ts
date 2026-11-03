import type { HistoryGate, Precedent } from "./types";

// Teams answer the same questions again and again. A gate that looks like one the team has
// already decided shows that decision, so the earlier reasoning isn't lost in the audit log.
// Pure string work, no AI: deterministic, free, and nothing leaves the server.

const SIMILAR_AT = 0.6;

// The command with the parts that change from run to run set aside: secrets, quoted values,
// numbers, hashes and the values of VAR=value prefixes.
export function commandShape(command: string): string {
  return command
    .toLowerCase()
    .replace(/\[redacted\]/g, "‹s›")
    .replace(/"[^"]*"|'[^']*'/g, "‹q›")
    .replace(/\b([a-z_][a-z0-9_]*)=\S+/g, "$1=‹v›")
    .replace(/\b[0-9a-f]{7,}\b/g, "‹h›")
    .replace(/\d+/g, "‹n›")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(shape: string): Set<string> {
  return new Set(shape.split(" ").filter(Boolean));
}

// Jaccard similarity of the two shapes' words.
export function shapeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function deciders(gate: HistoryGate): string[] {
  if (gate.status === "denied") {
    const denial = gate.votes.find((vote) => vote.decision === "deny");
    return denial ? [denial.name] : [];
  }
  return gate.votes.filter((vote) => vote.decision === "approve").map((vote) => vote.name);
}

// The closest earlier decision: the same command beats a similar one, this repo beats another
// repo in the team, and among equals the most recent wins. Similar commands must also share
// the preset, so a deploy never borrows the verdict of a migration.
export function findPrecedent(
  target: { id: string; repo: string; preset: string; command: string; createdAt: string },
  history: HistoryGate[],
): Precedent | null {
  const shape = commandShape(target.command);
  const before = Date.parse(target.createdAt);
  let best: { gate: HistoryGate; score: number; same: boolean } | null = null;
  const tally = { approved: 0, denied: 0 };

  for (const gate of history) {
    if (gate.id === target.id || Date.parse(gate.createdAt) >= before) continue;
    const similarity = shapeSimilarity(shape, commandShape(gate.command));
    const same = similarity === 1;
    const sameRepo = gate.repo === target.repo;
    if (same && sameRepo) tally[gate.status] += 1;
    if (!same && (similarity < SIMILAR_AT || gate.preset !== target.preset)) continue;

    const score = (same ? 2 : similarity) + (sameRepo ? 0.5 : 0);
    const newer =
      best !== null &&
      score === best.score &&
      Date.parse(gate.createdAt) > Date.parse(best.gate.createdAt);
    if (best === null || score > best.score || newer) best = { gate, score, same };
  }
  if (!best) return null;

  const { gate } = best;
  return {
    gateId: gate.id,
    code: gate.code,
    status: gate.status,
    by: deciders(gate),
    reason: gate.status === "denied" ? gate.denyReason : null,
    decidedAt: gate.decidedAt ?? gate.createdAt,
    match: best.same ? "same" : "similar",
    repo: gate.repo,
    sameRepo: gate.repo === target.repo,
    tally,
  };
}
