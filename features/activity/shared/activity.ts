// What happened in your teams lately, as one feed: gates raised, decisions, questions,
// parking. Built from gate rows; your own actions are left out (you know about those).

export type ActivityGate = {
  id: string;
  code: number;
  teamId: string;
  teamName: string;
  requester: { id: string; name: string };
  // As stored: secrets were removed on the developer's machine and on the server.
  command: string;
  status: string;
  question: string | null;
  createdAt: string;
  parkedAt: string | null;
  decidedAt: string | null;
  autoApproved: boolean;
  votes: {
    userId: string;
    name: string;
    decision: "approve" | "deny";
    reason: string | null;
    at: string;
  }[];
};

export type ActivityEvent = {
  id: string;
  at: string;
  teamId: string;
  teamName: string;
  gateId: string;
  code: number;
  kind: "raised" | "approved" | "denied" | "asked" | "parked" | "auto";
  text: string;
  // The command's first line, so the feed says what each gate is about.
  command: string;
  // Still waiting for a decision now (pending or parked): worth opening.
  waiting: boolean;
  // Your agent's gate: decisions on it matter most to you.
  mine: boolean;
};

const COMMAND_PREVIEW = 120;

export function commandPreview(command: string): string {
  const line = command.split("\n")[0]?.trim() ?? "";
  return line.length > COMMAND_PREVIEW ? `${line.slice(0, COMMAND_PREVIEW - 1)}…` : line;
}

const LIMIT = 40;

export function activityEvents(gates: ActivityGate[], viewerId: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const gate of gates) {
    const base = {
      teamId: gate.teamId,
      teamName: gate.teamName,
      gateId: gate.id,
      code: gate.code,
      command: commandPreview(gate.command),
      waiting: gate.status === "pending" || gate.status === "parked",
      mine: gate.requester.id === viewerId,
    };
    if (!base.mine) {
      events.push({
        ...base,
        id: `${gate.id}:raised`,
        at: gate.createdAt,
        kind: "raised",
        text: `${gate.requester.name}'s agent raised TG-${gate.code}`,
      });
    }
    for (const vote of gate.votes) {
      if (vote.userId === viewerId) continue;
      const asked = vote.decision === "deny" && gate.question !== null;
      const kind = vote.decision === "approve" ? "approved" : asked ? "asked" : "denied";
      const verb = kind === "asked" ? "asked about" : kind;
      events.push({
        ...base,
        id: `${gate.id}:vote:${vote.userId}`,
        at: vote.at,
        kind,
        text: `${vote.name} ${verb} ${base.mine ? "your agent's " : ""}TG-${gate.code}${vote.reason ? `: "${vote.reason}"` : ""}`,
      });
    }
    if (gate.parkedAt) {
      events.push({
        ...base,
        id: `${gate.id}:parked`,
        at: gate.parkedAt,
        kind: "parked",
        text: `TG-${gate.code} parked: nobody decided in time`,
      });
    }
    if (gate.autoApproved && gate.decidedAt) {
      events.push({
        ...base,
        id: `${gate.id}:auto`,
        at: gate.decidedAt,
        kind: "auto",
        text: `TG-${gate.code} approved by a team rule`,
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}

export function unreadCount(events: ActivityEvent[], seenAt: number): number {
  return events.filter((event) => Date.parse(event.at) > seenAt).length;
}
