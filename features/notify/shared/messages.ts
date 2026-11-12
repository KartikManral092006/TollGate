// Notification copy. Pure, so the wording is unit-tested and shared by every channel
// (Nexconn system message + push text, email, browser notification).

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export type GateNoticeInput = {
  code: number;
  env: string;
  preset: string;
  repo: string;
  command: string;
  requester: string;
  quorum: number;
  url: string;
  // The agent's own description of the command, when Claude Code sent one.
  intent?: string | null;
};

function intentLine(intent: string | null | undefined): string | null {
  return intent ? `The agent says: "${shorten(intent, 200)}"` : null;
}

// To approvers: a new gate needs a decision.
export function gateWaitingNotice(input: GateNoticeInput) {
  const where = input.env === "prod" ? "PROD" : input.env;
  const headline = `TG-${input.code} needs your decision: ${input.requester}'s agent wants to run ${input.preset} on ${where}`;
  const command = shorten(input.command, 300);
  const push = shorten(`TG-${input.code} · ${input.requester}: ${command}`, 120);
  return {
    push,
    chat: [headline, intentLine(input.intent), command, input.url].filter(Boolean).join("\n"),
    subject: `TG-${input.code} is waiting on you (${input.repo})`,
    text: [
      headline,
      "",
      `  ${command}`,
      "",
      ...(input.intent ? [intentLine(input.intent)!, ""] : []),
      `Repo: ${input.repo} · Approvals needed: ${input.quorum}`,
      "",
      `Approve or deny: ${input.url}`,
      "",
      "If nobody decides in a few minutes, the gate is parked and can still be approved later.",
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(headline)}</strong></p>`,
      `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(command)}</pre>`,
      input.intent ? `<p>${escapeHtml(intentLine(input.intent)!)}</p>` : "",
      `<p>Repo: ${escapeHtml(input.repo)} · Approvals needed: ${input.quorum}</p>`,
      `<p><a href="${escapeHtml(input.url)}">Approve or deny TG-${input.code}</a></p>`,
      `<p style="color:#71717a">If nobody decides in a few minutes, the gate is parked and can still be approved later.</p>`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// To the requester, for a gate their agent already gave up waiting on (parked).
export function parkedDecisionNotice(input: {
  code: number;
  approved: boolean;
  decider: string;
  reason: string | null;
  url: string;
}) {
  const headline = input.approved
    ? `TG-${input.code} approved by ${input.decider}: retry the same command and it passes once (within 24 h)`
    : `TG-${input.code} denied by ${input.decider}${input.reason ? `: ${input.reason}` : ""}`;
  return {
    push: shorten(headline, 120),
    chat: `${headline}\n${input.url}`,
    subject: input.approved ? `TG-${input.code} approved: retry now` : `TG-${input.code} denied`,
    text: [headline, "", input.url].join("\n"),
    html: [
      `<p><strong>${escapeHtml(headline)}</strong></p>`,
      `<p><a href="${escapeHtml(input.url)}">Open TG-${input.code}</a></p>`,
    ].join("\n"),
  };
}

// To approvers who haven't voted, when nobody decided in time: once when the gate parks, and
// once more ("late") if it is still undecided an hour later.
export function gateParkedNotice(
  input: Omit<GateNoticeInput, "quorum" | "env" | "preset"> & { late: boolean },
) {
  const headline = input.late
    ? `TG-${input.code} is still waiting after an hour: ${input.requester}'s agent can't run it until someone decides`
    : `TG-${input.code} is parked: nobody decided in time, so ${input.requester}'s agent moved on`;
  const next =
    "Approve it and the agent's retry passes once within 24 h, or deny it with a reason.";
  const command = shorten(input.command, 300);
  return {
    push: shorten(`${headline}`, 120),
    chat: [headline, intentLine(input.intent), command, input.url].filter(Boolean).join("\n"),
    subject: input.late
      ? `Reminder: TG-${input.code} still needs a decision (${input.repo})`
      : `TG-${input.code} is parked and still needs a decision (${input.repo})`,
    text: [
      headline,
      "",
      `  ${command}`,
      "",
      ...(input.intent ? [intentLine(input.intent)!, ""] : []),
      next,
      "",
      `Decide: ${input.url}`,
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(headline)}</strong></p>`,
      `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(command)}</pre>`,
      input.intent ? `<p>${escapeHtml(intentLine(input.intent)!)}</p>` : "",
      `<p>${escapeHtml(next)}</p>`,
      `<p><a href="${escapeHtml(input.url)}">Decide on TG-${input.code}</a></p>`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// To approvers: a gated call went through with TOLLGATE_BYPASS=1. It already ran; someone
// should look at it.
export function bypassNotice(input: Omit<GateNoticeInput, "quorum">) {
  const where = input.env === "prod" ? "PROD" : input.env;
  const headline = `TG-${input.code} ran without approval: ${input.requester} bypassed Tollgate for ${input.preset} on ${where}`;
  const command = shorten(input.command, 300);
  const next = "It has already run. Look at what it did and mark it reviewed.";
  return {
    push: shorten(`TG-${input.code} bypassed · ${input.requester}: ${command}`, 120),
    chat: [headline, command, next, input.url].join("\n"),
    subject: `TG-${input.code} ran without approval (${input.repo})`,
    text: [headline, "", `  ${command}`, "", next, "", `Review: ${input.url}`].join("\n"),
    html: [
      `<p><strong>${escapeHtml(headline)}</strong></p>`,
      `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(command)}</pre>`,
      `<p>${escapeHtml(next)}</p>`,
      `<p><a href="${escapeHtml(input.url)}">Review TG-${input.code}</a></p>`,
    ].join("\n"),
  };
}
