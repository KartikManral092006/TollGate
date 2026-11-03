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
};

// To approvers: a new gate needs a decision.
export function gateWaitingNotice(input: GateNoticeInput) {
  const where = input.env === "prod" ? "PROD" : input.env;
  const headline = `TG-${input.code} needs your decision: ${input.requester}'s agent wants to run ${input.preset} on ${where}`;
  const command = shorten(input.command, 300);
  const push = shorten(`TG-${input.code} · ${input.requester}: ${command}`, 120);
  return {
    push,
    chat: `${headline}\n${command}\n${input.url}`,
    subject: `TG-${input.code} is waiting on you (${input.repo})`,
    text: [
      headline,
      "",
      `  ${command}`,
      "",
      `Repo: ${input.repo} · Approvals needed: ${input.quorum}`,
      "",
      `Approve or deny: ${input.url}`,
      "",
      "If nobody decides in a few minutes, the gate is parked and can still be approved later.",
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(headline)}</strong></p>`,
      `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(command)}</pre>`,
      `<p>Repo: ${escapeHtml(input.repo)} · Approvals needed: ${input.quorum}</p>`,
      `<p><a href="${escapeHtml(input.url)}">Approve or deny TG-${input.code}</a></p>`,
      `<p style="color:#71717a">If nobody decides in a few minutes, the gate is parked and can still be approved later.</p>`,
    ].join("\n"),
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
