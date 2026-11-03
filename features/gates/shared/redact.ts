// Shared by the CLI hook (runs first, on the developer's machine) and the server (runs again
// on everything it receives). Pure: no "@/" imports. Erring toward over-redaction is fine;
// the card says how many values were hidden.

export const REDACTED = "[REDACTED]";

type Rule = { name: string; re: RegExp; replace: (match: string, ...groups: string[]) => string };

const whole = () => REDACTED;

const RULES: Rule[] = [
  {
    name: "private-key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: whole,
  },
  // user:password@ in any URL keeps the user, hides the password.
  {
    name: "url-credentials",
    re: /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi,
    replace: (_m, scheme: string, user: string) => `${scheme}${user}:${REDACTED}@`,
  },
  { name: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replace: whole },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, replace: whole },
  { name: "github-pat", re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, replace: whole },
  { name: "slack-token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, replace: whole },
  { name: "stripe-key", re: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: whole },
  { name: "llm-key", re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g, replace: whole },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: whole },
  { name: "npm-token", re: /\bnpm_[A-Za-z0-9]{36}\b/g, replace: whole },
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: whole,
  },
  {
    name: "bearer",
    re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}=*/g,
    replace: (_m, scheme: string) => `${scheme} ${REDACTED}`,
  },
  // FOO_TOKEN=..., export DB_PASSWORD="...", etc. Non-secret names (NODE_ENV=prod) stay.
  // DATABASE_URL=... is left to url-credentials on purpose: approvers need to see the host.
  {
    name: "secret-assignment",
    re: /\b([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIALS?|AUTH)[A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s;&|]+)/gi,
    replace: (_m, name: string) => `${name}=${REDACTED}`,
  },
  {
    name: "secret-flag",
    re: /(--(?:password|passwd|token|secret|api-key|apikey|access-key|secret-key|auth-token)(?:=|\s+))("[^"]*"|'[^']*'|[^\s;&|]+)/gi,
    replace: (_m, flag: string) => `${flag}${REDACTED}`,
  },
  // mysql -pSECRET (no space) is the documented form.
  {
    name: "mysql-password",
    re: /(\bmysql(?:dump)?\b[^;&|]*?\s-p)([^\s;&|]+)/g,
    replace: (_m, prefix: string) => `${prefix}${REDACTED}`,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type RedactResult = { text: string; count: number };

// `knownSecrets` are literal values (e.g. read from .env files by the hook). Short values are
// skipped: replacing "1" or "true" everywhere would wreck the command without hiding anything.
export function redact(input: string, knownSecrets: readonly string[] = []): RedactResult {
  let text = input;
  let count = 0;

  const literals = [...new Set(knownSecrets)]
    .filter((value) => value.length >= 8 && !value.includes(REDACTED))
    .sort((a, b) => b.length - a.length);
  for (const literal of literals) {
    const re = new RegExp(escapeRegExp(literal), "g");
    text = text.replace(re, () => {
      count += 1;
      return REDACTED;
    });
  }

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    text = text.replace(rule.re, (match: string, ...rest: unknown[]) => {
      // A value we already hid (e.g. a .env literal) is not counted twice.
      if (match === REDACTED) return match;
      const groups = rest.filter((value): value is string => typeof value === "string");
      const replaced = rule.replace(match, ...groups);
      if (replaced !== match) count += 1;
      return replaced;
    });
  }
  return { text, count };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 15))}… [truncated]`;
}
