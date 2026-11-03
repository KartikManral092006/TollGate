// See-through matching: what a shell command actually runs, so a preset can match the risky
// part wherever it sits. Shared by the CLI hook and the server (bundled into packages/cli), so:
// no "@/" imports and no Node APIs; package.json is read through an injected function.
//
// It is deliberately not a shell parser. It understands the shapes coding agents really use:
//   - lists and pipelines:          a && b; c || d | e, newlines, a & b
//   - wrapper prefixes:             VAR=x, env, sudo, time, nohup, nice, command, exec,
//                                   npx, bunx, pnpm exec|dlx, yarn dlx|exec, npm exec|x,
//                                   dotenv … --, cross-env
//   - literal inner scripts:        bash|sh|zsh -c '…', eval '…', ( … ), { …; }, $( … ), `…`
//   - package scripts:              npm run X, npm test, pnpm X, yarn X, bun run X (+ pre/post)
// Anything it can't see through (a script built from a variable, code piped from the network)
// is left to the `opaque` preset, which gates it as unreviewable.

export type Segment = {
  // One pipeline with wrapper prefixes removed, e.g. "prisma migrate deploy | tee log".
  text: string;
  // How the command got here, outermost first: ["pnpm db:deploy"] for a package script.
  via: string[];
};

export type ScriptReader = (cwd: string) => Record<string, string> | null;

export type ExpandOptions = {
  cwd: string;
  readScripts?: ScriptReader;
  maxDepth?: number;
  maxSegments?: number;
};

const MAX_DEPTH = 4;
const MAX_SEGMENTS = 64;
const MAX_LABEL = 80;

type Scan = { quote: "'" | '"' | null; depth: number; backtick: boolean };

// Walks `text`, calling `onChar` for every character with the quoting state *before* it.
function scan(text: string, onChar: (index: number, state: Scan) => number | void): void {
  const state: Scan = { quote: null, depth: 0, backtick: false };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const skip = onChar(i, state);
    if (typeof skip === "number") {
      i = skip;
      continue;
    }
    if (state.quote === "'") {
      if (ch === "'") state.quote = null;
      continue;
    }
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (state.quote === '"') {
      if (ch === '"') state.quote = null;
      else if (ch === "$" && text[i + 1] === "(") {
        state.depth += 1;
        i += 1;
      } else if (ch === ")" && state.depth > 0) state.depth -= 1;
      continue;
    }
    if (ch === "'" || ch === '"') state.quote = ch;
    else if (ch === "`") state.backtick = !state.backtick;
    else if (ch === "(") state.depth += 1;
    else if (ch === ")" && state.depth > 0) state.depth -= 1;
  }
}

const atTop = (s: Scan) => s.quote === null && s.depth === 0 && !s.backtick;

// Splits a command list into pipelines on unquoted ; && || & and newlines. Comments go too.
export function splitList(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  scan(text, (i, s) => {
    if (!atTop(s)) return;
    const ch = text[i]!;
    const next = text[i + 1];
    const prev = text[i - 1];
    if (ch === "#" && (i === 0 || /\s/.test(prev!))) {
      parts.push(text.slice(start, i));
      const end = text.indexOf("\n", i);
      start = end === -1 ? text.length : end + 1;
      return end === -1 ? text.length : end;
    }
    if (ch === ";" || ch === "\n") {
      parts.push(text.slice(start, i));
      start = i + 1;
    } else if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
      parts.push(text.slice(start, i));
      start = i + 2;
      return i + 1;
    } else if (ch === "&" && prev !== ">" && prev !== "<" && prev !== "|" && next !== ">") {
      // A background job: "a & b" runs both. Not "2>&1", "&>file" or ">&2".
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  });
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

// Splits a pipeline into its commands on unquoted | (and |&).
export function splitPipeline(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  scan(text, (i, s) => {
    if (!atTop(s) || text[i] !== "|") return;
    parts.push(text.slice(start, i));
    const skipAmp = text[i + 1] === "&";
    start = i + (skipAmp ? 2 : 1);
    return skipAmp ? i + 1 : undefined;
  });
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

// Shell words with quotes removed. $(…) and `…` stay whole, so a substitution is one word.
export function shellWords(text: string): string[] {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;
  let depth = 0;
  let backtick = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }
    if (ch === "\\" && i + 1 < text.length) {
      current += text[i + 1];
      inWord = true;
      i += 1;
      continue;
    }
    if (quote === '"') {
      if (ch === '"' && depth === 0) quote = null;
      else {
        if (ch === "$" && text[i + 1] === "(") depth += 1;
        else if (ch === ")" && depth > 0) depth -= 1;
        current += ch;
      }
      continue;
    }
    if (depth > 0 || backtick) {
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === "`") backtick = false;
      current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inWord) words.push(current);
      current = "";
      inWord = false;
      continue;
    }
    inWord = true;
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "$" && text[i + 1] === "(") {
      depth = 1;
      current += "$(";
      i += 1;
    } else if (ch === "`") {
      backtick = true;
      current += ch;
    } else current += ch;
  }
  if (inWord) words.push(current);
  return words;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const base = (word: string) => word.slice(word.lastIndexOf("/") + 1);

// Drops leading flags; flags in `withValue` also drop the word after them.
function skipFlags(words: string[], withValue: Set<string> = new Set()): string[] {
  let i = 0;
  while (i < words.length && words[i]!.startsWith("-") && words[i] !== "--") {
    i += withValue.has(words[i]!) ? 2 : 1;
  }
  if (words[i] === "--") i += 1;
  return words.slice(i);
}

const SUDO_VALUE = new Set(["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U", "-T"]);
const NPX_VALUE = new Set(["-p", "--package", "-c", "--call"]);
const ENV_VALUE = new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"]);

// Removes wrappers that run the rest of the line as the real command.
export function stripPrefixes(input: string[]): string[] {
  let words = input;
  for (let guard = 0; guard < 16 && words.length > 0; guard++) {
    const first = base(words[0]!);
    const second = words[1];
    let next: string[] | null = null;
    if (ASSIGNMENT.test(words[0]!)) next = words.slice(1);
    else if (first === "env") {
      next = skipFlags(words.slice(1), ENV_VALUE);
      while (next.length > 0 && ASSIGNMENT.test(next[0]!)) next = next.slice(1);
    } else if (first === "sudo" || first === "doas") next = skipFlags(words.slice(1), SUDO_VALUE);
    else if (["time", "nohup", "command", "exec", "builtin"].includes(first)) {
      next = skipFlags(words.slice(1));
    } else if (first === "nice") next = skipFlags(words.slice(1), new Set(["-n"]));
    else if (first === "npx" || first === "bunx") next = skipFlags(words.slice(1), NPX_VALUE);
    else if (first === "pnpm" && (second === "exec" || second === "dlx")) {
      next = skipFlags(words.slice(2));
    } else if (first === "yarn" && (second === "dlx" || second === "exec")) {
      next = skipFlags(words.slice(2));
    } else if (first === "npm" && (second === "exec" || second === "x")) {
      next = skipFlags(words.slice(2), NPX_VALUE);
    } else if (first === "dotenv" || first === "dotenvx") {
      const dash = words.indexOf("--");
      next =
        dash === -1
          ? skipFlags(words.slice(1), new Set(["-e", "-f", "-v", "-c"]))
          : words.slice(dash + 1);
      if (first === "dotenvx" && next[0] === "run")
        next = skipFlags(next.slice(1), new Set(["-f"]));
    } else if (first === "cross-env") {
      next = words.slice(1);
      while (next.length > 0 && ASSIGNMENT.test(next[0]!)) next = next.slice(1);
    }
    if (next === null) break;
    words = next;
  }
  return words;
}

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);

// The literal script a wrapper runs: bash -c '…' or eval '…'. Null when there isn't one.
export function innerScript(words: string[]): string | null {
  if (words.length === 0) return null;
  const first = base(words[0]!);
  if (SHELLS.has(first)) {
    const flag = words.findIndex((word, i) => i > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(word));
    return flag !== -1 && words[flag + 1] !== undefined ? words[flag + 1]! : null;
  }
  if (first === "eval") return words.slice(1).join(" ") || null;
  return null;
}

// $(…) and `…` inside a command run before it, so they are commands too.
export function substitutions(text: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      const end = text.indexOf("'", i + 1);
      if (end === -1) break;
      i = end;
      continue;
    }
    if (text[i] === "$" && text[i + 1] === "(" && text[i + 2] !== "(") {
      let depth = 1;
      let j = i + 2;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === "(") depth += 1;
        else if (text[j] === ")") depth -= 1;
      }
      found.push(text.slice(i + 2, j - 1));
      i = j - 1;
    } else if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end === -1) break;
      found.push(text.slice(i + 1, end));
      i = end;
    }
  }
  return found.filter((inner) => inner.trim());
}

// Subcommands that are the tool's own, not a package script with that name.
const PNPM_BUILTINS = new Set(
  "add i install update up upgrade remove rm uninstall un link ln unlink import rebuild rb prune fetch patch patch-commit exec dlx create publish pack audit list ls outdated why store root bin config c get set env init setup server deploy licenses doctor approve-builds ignored-builds self-update cat-file cat-index find-hash recursive multi m help".split(
    " ",
  ),
);
const YARN_BUILTINS = new Set(
  "add install remove upgrade up publish init info why dlx exec workspace workspaces config cache link unlink pack version global import npm plugin set constraints dedupe explain node rebuild search stage unplug patch patch-commit login logout owner tag team audit autoclean check generate-lock-entry help licenses list outdated policies upgrade-interactive".split(
    " ",
  ),
);
const RUNNER_VALUE = new Set([
  "-C",
  "--dir",
  "--prefix",
  "--filter",
  "-F",
  "-w",
  "--workspace",
  "--cwd",
]);
const NPM_LIFECYCLE: Record<string, string> = {
  test: "test",
  t: "test",
  tst: "test",
  start: "start",
  stop: "stop",
  restart: "restart",
};

// The package script a runner command invokes: "pnpm db:deploy" -> "db:deploy".
export function scriptName(words: string[], scripts: Record<string, string> | null): string | null {
  if (words.length < 2) return null;
  const tool = base(words[0]!);
  const rest = skipFlags(words.slice(1), RUNNER_VALUE);
  const sub = rest[0];
  if (!sub) return null;
  const after = skipFlags(rest.slice(1), RUNNER_VALUE)[0] ?? null;
  if (tool === "npm") {
    if (["run", "run-script", "rum", "urn"].includes(sub)) return after;
    return NPM_LIFECYCLE[sub] ?? null;
  }
  if (tool === "pnpm") {
    if (sub === "run" || sub === "run-script") return after;
    return PNPM_BUILTINS.has(sub) ? null : sub;
  }
  if (tool === "yarn") {
    if (sub === "run") return after;
    return YARN_BUILTINS.has(sub) ? null : sub;
  }
  if (tool === "bun") {
    if (sub === "run") return after;
    return scripts && sub in scripts ? sub : null;
  }
  return null;
}

function label(words: string[]): string {
  const text = words.join(" ");
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text;
}

export function expandCommand(command: string, options: ExpandOptions): Segment[] {
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const maxSegments = options.maxSegments ?? MAX_SEGMENTS;
  const segments: Segment[] = [];
  let scripts: Record<string, string> | null | undefined;
  const loadScripts = () => {
    if (scripts === undefined) {
      try {
        scripts = options.readScripts?.(options.cwd) ?? null;
      } catch {
        scripts = null;
      }
    }
    return scripts;
  };

  const visit = (text: string, via: string[], depth: number, seen: Set<string>) => {
    for (const pipeline of splitList(text)) {
      if (segments.length >= maxSegments) return;
      // A subshell or group: ( … ) / { …; } runs its contents.
      const group = /^\(([\s\S]*)\)$/.exec(pipeline) ?? /^\{([\s\S]*?);?\s*\}$/.exec(pipeline);
      if (group) {
        if (depth < maxDepth) visit(group[1]!, via, depth + 1, seen);
        continue;
      }
      const commands = splitPipeline(pipeline).map((part) => stripPrefixes(shellWords(part)));
      const flat = commands
        .map((words) => words.join(" "))
        .filter(Boolean)
        .join(" | ");
      if (flat) segments.push({ text: flat, via });
      if (depth >= maxDepth) continue;

      for (const inner of substitutions(pipeline)) {
        visit(inner, [...via, "$(…)"], depth + 1, seen);
      }
      for (const words of commands) {
        const script = innerScript(words);
        if (script) {
          const wrapper = base(words[0]!) === "eval" ? "eval" : `${base(words[0]!)} -c`;
          visit(script, [...via, wrapper], depth + 1, seen);
        }

        const name = scriptName(words, loadScripts() ?? null);
        const all = loadScripts();
        if (!name || !all || seen.has(name) || !(name in all)) continue;
        const nextSeen = new Set(seen).add(name);
        const from = [...via, label(words)];
        for (const key of [`pre${name}`, name, `post${name}`]) {
          const body = all[key];
          if (typeof body === "string" && body.trim()) {
            visit(body.slice(0, 2000), from, depth + 1, nextSeen);
          }
        }
      }
    }
  };

  visit(command, [], 0, new Set());
  return segments;
}
