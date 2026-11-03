import type { WhyInput } from "./prompt";

// The default "Why?": rule-based, so it is free, instant, private and can't be steered by text
// inside the command. It knows the presets Tollgate gates on and reads migration SQL for the
// statements that destroy data. Also the fallback when a team's AI provider fails.

const PRESET_SUMMARY: Record<string, string> = {
  "prod-deploy":
    "Deploys this code to production, where real users will get it as soon as it finishes.",
  "staging-deploy":
    "Deploys this code to a shared staging environment that teammates and test systems use.",
  "db-migrate":
    "Applies database migrations, changing the structure of the database (and possibly its data).",
  publish:
    "Publishes a package to a public registry. Anyone can download it, and published versions generally can't be taken back.",
  infra:
    "Changes cloud infrastructure: it can create, modify or delete servers, databases or storage.",
  "destructive-fs":
    "Deletes files or folders outside this repository, which version control can't restore.",
  "tollgate-test": "A harmless test command that only prints text. It changes nothing.",
};

const UNDO: Record<string, string> = {
  "prod-deploy":
    "Usually reversible by redeploying the previous version, but users may see the change first.",
  "staging-deploy": "Reversible by redeploying the previous version.",
  publish:
    "Hard to undo: registries keep published versions, and people may have installed it already.",
  infra: "Deleted resources usually can't be recovered.",
  "destructive-fs": "Can't be undone unless there's a backup.",
  "tollgate-test": "Nothing to undo.",
};

type Finding = { pattern: RegExp; warning: string };

const SQL_FINDINGS: Finding[] = [
  { pattern: /\bDROP\s+TABLE\b/i, warning: "drops a table, deleting all of its rows" },
  { pattern: /\bDROP\s+COLUMN\b/i, warning: "drops a column, deleting every value stored in it" },
  { pattern: /\bTRUNCATE\b/i, warning: "truncates a table, deleting all of its rows" },
  {
    pattern: /\bDELETE\s+FROM\b(?![^;]*\bWHERE\b)/i,
    warning: "deletes rows without a WHERE clause, so every row in the table",
  },
  { pattern: /\bDELETE\s+FROM\b[^;]*\bWHERE\b/i, warning: "deletes the rows matching a condition" },
  {
    pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b|\bALTER\s+TABLE\b[^;]*\bTYPE\b/i,
    warning: "changes a column's type, which can fail or lose precision on existing data",
  },
  {
    pattern: /\bRENAME\s+(COLUMN|TO)\b/i,
    warning: "renames something that existing code may still use by its old name",
  },
  {
    pattern:
      /\bSET\s+NOT\s+NULL\b|\bNOT\s+NULL\b[^;]*\bADD\s+COLUMN\b|\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i,
    warning: "adds a NOT NULL requirement, which fails if existing rows have no value",
  },
];

const COMMAND_FINDINGS: Finding[] = [
  {
    pattern: /\bprisma\s+migrate\s+reset\b/i,
    warning: "resets the database: it drops everything and rebuilds it from scratch",
  },
  {
    pattern: /\bprisma\s+db\s+push\b.*--accept-data-loss/i,
    warning: "pushes the schema while explicitly accepting data loss",
  },
  {
    pattern: /\bterraform\s+destroy\b|\bpulumi\s+destroy\b/i,
    warning: "destroys every resource in this stack",
  },
  {
    pattern: /-auto-approve\b|--yes\b|\s-y\b/i,
    warning: "skips the tool's own confirmation prompt",
  },
  { pattern: /--force\b|\s-f\b/i, warning: "forces the operation past the tool's safety checks" },
  {
    pattern: /\baws\s+s3\s+(rm|rb)\b.*--recursive/i,
    warning: "deletes every object under that S3 path",
  },
  {
    pattern: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i,
    warning: "deletes recursively without asking",
  },
];

function findings(list: Finding[], text: string): string[] {
  return list.filter((finding) => finding.pattern.test(text)).map((finding) => finding.warning);
}

function envLine(env: string): string | null {
  if (env === "prod") return "Environment: production. Real users and real data are affected.";
  if (env === "staging") return "Environment: staging, shared with the rest of the team.";
  return null;
}

export function builtinExplanation(input: WhyInput): string {
  const lines: string[] = [];
  lines.push(
    PRESET_SUMMARY[input.preset] ??
      `Tollgate stopped this command because it matches the team's "${input.preset}" rule.`,
  );
  const envText = envLine(input.env);
  if (envText) lines.push(envText);

  const warnings = [
    ...findings(COMMAND_FINDINGS, input.command),
    ...(input.preset === "db-migrate" ? findings(SQL_FINDINGS, input.context) : []),
  ];
  if (warnings.length > 0) {
    lines.push(`Watch out: this ${[...new Set(warnings)].join("; it ")}.`);
  } else if (input.preset === "db-migrate" && input.context) {
    lines.push("The migration shown in Context doesn't contain statements that delete data.");
  }

  const undo =
    input.preset === "db-migrate"
      ? warnings.some((w) => /delet|drop|truncat|reset|destroy/.test(w))
        ? "Deleted data can't be recovered without a backup."
        : "Schema changes can usually be reverted with another migration."
      : UNDO[input.preset];
  if (undo) lines.push(undo);

  if (input.preset === "db-migrate" && !input.context) {
    lines.push("Open Context to see which migration will run, or ask the requester.");
  }
  return lines.join("\n");
}
