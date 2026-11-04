import { isAbsolute, relative, resolve, sep } from "node:path";
import type { GateTool } from "../../../features/gates/shared/presets";

// What the hook gates besides Bash. Each call becomes one line that presets match and
// approvers read ("edit .github/workflows/deploy.yml", "mcp__stripe__create_refund {…}"),
// plus, for an edit, the change itself.

export const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export type ToolCall = {
  tool: GateTool;
  subject: string;
  // Binds a grant to this exact call: approving one edit doesn't approve a different one.
  hashSource: string;
  detail: string;
};

const MAX_DETAIL_LINES = 80;

const str = (value: unknown) => (typeof value === "string" ? value : "");

// Repo-relative where possible, ~/… in the home folder, absolute otherwise; always "/".
export function displayPath(file: string, cwd: string, repoRoot: string, home: string): string {
  const absolute = resolve(cwd, file);
  const inside = (base: string) => {
    const rel = relative(base, absolute);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : null;
  };
  const inRepo = inside(repoRoot);
  if (inRepo) return inRepo;
  const inHome = inside(home);
  return inHome ? `~/${inHome}` : absolute.split(sep).join("/");
}

function lines(prefix: string, text: string): string[] {
  return text === "" ? [] : text.split("\n").map((line) => `${prefix}${line}`);
}

// .env files hold secrets that aren't in the redaction list yet (they're being written now):
// keep the names, hide every value.
function hideEnvValues(text: string): string {
  return text.replace(/^([+-] \s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=).*$/gm, "$1[REDACTED]");
}

function editDetail(toolName: string, input: Record<string, unknown>): string {
  let out: string[];
  if (toolName === "Write") {
    out = lines("+ ", str(input.content));
  } else if (toolName === "NotebookEdit") {
    out =
      input.edit_mode === "delete"
        ? ["(deletes a notebook cell)"]
        : lines("+ ", str(input.new_source));
  } else {
    const edits =
      toolName === "MultiEdit" && Array.isArray(input.edits)
        ? (input.edits as Record<string, unknown>[])
        : [input];
    out = edits.flatMap((edit, index) => [
      ...(index > 0 ? [""] : []),
      ...lines("- ", str(edit.old_string)),
      ...lines("+ ", str(edit.new_string)),
      ...(edit.replace_all === true ? ["(every occurrence in the file)"] : []),
    ]);
  }
  const shown = out.slice(0, MAX_DETAIL_LINES);
  if (out.length > shown.length) shown.push(`… ${out.length - shown.length} more lines`);
  return shown.join("\n");
}

export function readToolCall(
  toolName: string,
  rawInput: unknown,
  where: { cwd: string; repoRoot: string; home: string },
): ToolCall | null {
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as Record<
    string,
    unknown
  >;
  const hashSource = `${toolName}\n${JSON.stringify(input)}`;

  if (EDIT_TOOLS.has(toolName)) {
    const file = str(input.file_path) || str(input.notebook_path);
    if (!file) return null;
    const path = displayPath(file, where.cwd, where.repoRoot, where.home);
    const detail = editDetail(toolName, input);
    const isEnv = /(^|\/)\.env[^/]*$/.test(path);
    return {
      tool: "edit",
      subject: `${toolName === "Write" ? "write" : "edit"} ${path}`,
      hashSource,
      detail: isEnv ? hideEnvValues(detail) : detail,
    };
  }

  if (toolName.startsWith("mcp__")) {
    const args = JSON.stringify(input);
    return {
      tool: "mcp",
      subject: args === "{}" ? toolName : `${toolName} ${args}`,
      hashSource,
      detail: "",
    };
  }
  return null;
}
