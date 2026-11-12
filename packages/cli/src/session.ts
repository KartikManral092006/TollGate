import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { STEP_MAX, STEPS_MAX, TASK_MAX } from "../../../features/gates/shared/hook-api";

// What the agent was asked and what it just did, per Claude Code session, kept on this machine
// only. Claude Code's transcript format is internal and changes between versions, so the hook
// keeps its own short notes from documented events instead: UserPromptSubmit for the
// developer's instruction, PostToolUse for each call. Sent with a gate only when the team has
// turned it on (the grant check says so). Already redacted when written.

export type SessionNotes = {
  task: { text: string; at: number } | null;
  steps: { text: string; at: number }[];
};

// Notes this old belong to a finished session; they're deleted the next time a prompt is saved.
export const NOTES_TTL_MS = 7 * 86_400_000;

const EMPTY: SessionNotes = { task: null, steps: [] };

function notesDir(home: string): string {
  return join(home, "sessions");
}

// Claude Code's session ids are UUIDs; anything else is reduced to a safe file name.
export function notesFile(home: string, sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100) || "session";
  return join(notesDir(home), `${safe}.json`);
}

export function readNotes(home: string, sessionId: string): SessionNotes {
  try {
    const raw = JSON.parse(readFileSync(notesFile(home, sessionId), "utf8")) as SessionNotes;
    return {
      task:
        raw.task && typeof raw.task.text === "string"
          ? { text: raw.task.text, at: Number(raw.task.at) || 0 }
          : null,
      steps: Array.isArray(raw.steps)
        ? raw.steps
            .filter((step) => typeof step?.text === "string")
            .map((step) => ({ text: step.text, at: Number(step.at) || 0 }))
            .slice(-STEPS_MAX)
        : [],
    };
  } catch {
    return EMPTY;
  }
}

// Atomic and private: written to a temp file readable only by this user, then renamed.
function writeNotes(home: string, sessionId: string, notes: SessionNotes): void {
  mkdirSync(notesDir(home), { recursive: true, mode: 0o700 });
  const file = notesFile(home, sessionId);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(notes), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function saveTask(home: string, sessionId: string, text: string, now: number): void {
  const task = text.trim();
  if (!task) return;
  // A new instruction starts a new story: the steps before it were for the last one.
  writeNotes(home, sessionId, { task: { text: clip(task, TASK_MAX), at: now }, steps: [] });
  pruneNotes(home, now);
}

export function recordStep(home: string, sessionId: string, text: string, now: number): void {
  const step = text.replace(/\s+/g, " ").trim();
  if (!step) return;
  const notes = readNotes(home, sessionId);
  writeNotes(home, sessionId, {
    task: notes.task,
    steps: [...notes.steps, { text: clip(step, STEP_MAX), at: now }].slice(-STEPS_MAX),
  });
}

export function pruneNotes(home: string, now: number): void {
  let names: string[];
  try {
    names = readdirSync(notesDir(home));
  } catch {
    return;
  }
  for (const name of names) {
    const file = join(notesDir(home), name);
    try {
      if (now - statSync(file).mtimeMs > NOTES_TTL_MS) unlinkSync(file);
    } catch {
      // gone already
    }
  }
}
