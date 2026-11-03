import { describe, expect, it } from "vitest";
import { REDACTED, redact, truncate } from "@/features/gates/shared/redact";

describe("redact", () => {
  it.each([
    ["aws key", "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws s3 ls", "AKIAIOSFODNN7EXAMPLE"],
    ["bare aws key", "echo AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE"],
    ["github token", "gh auth login --with-token ghp_" + "a".repeat(36), "ghp_" + "a".repeat(36)],
    [
      "github pat",
      "git clone https://github_pat_" + "B".repeat(30) + "@github.com/x",
      "github_pat_",
    ],
    ["jwt", "curl -H 'x: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJlMTIz'", "eyJhbGci"],
    ["stripe", "STRIPE=sk_live_" + "x".repeat(24), "sk_live_"],
    ["anthropic", "export K=sk-ant-" + "y".repeat(30), "sk-ant-"],
    ["slack", "curl -d token=xoxb-1234567890-abcdef", "xoxb-1234567890"],
    ["npm", "npm publish --//registry.npmjs.org/:_authToken=npm_" + "z".repeat(36), "npm_zzz"],
    ["google", "curl ?key=AIza" + "Q".repeat(35), "AIzaQQQ"],
    ["bearer", 'curl -H "Authorization: Bearer abc.def.ghi123456"', "abc.def.ghi123456"],
  ])("hides a %s", (_name, input, secret) => {
    const result = redact(input);
    expect(result.text).not.toContain(secret);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  it("keeps the user but hides the password in a database URL", () => {
    const result = redact("psql postgres://ana:hunter2secret@db.internal:5432/billing");
    expect(result.text).toBe(`psql postgres://ana:${REDACTED}@db.internal:5432/billing`);
    expect(result.count).toBe(1);
  });

  it("hides secret-looking assignments and keeps ordinary ones", () => {
    const result = redact(
      'NODE_ENV=production DB_PASSWORD="p@ss w0rd" API_TOKEN=abc123 npx prisma migrate deploy',
    );
    expect(result.text).toBe(
      `NODE_ENV=production DB_PASSWORD=${REDACTED} API_TOKEN=${REDACTED} npx prisma migrate deploy`,
    );
    expect(result.count).toBe(2);
  });

  it("keeps the database host visible but hides its password", () => {
    expect(
      redact("DATABASE_URL=postgres://u:pw@db.prod:5432/app npx prisma migrate deploy").text,
    ).toBe(`DATABASE_URL=postgres://u:${REDACTED}@db.prod:5432/app npx prisma migrate deploy`);
  });

  it("hides secret flags in both = and space forms", () => {
    const result = redact("deploy --token abc123def --api-key=zzz999 --region eu");
    expect(result.text).toBe(`deploy --token ${REDACTED} --api-key=${REDACTED} --region eu`);
  });

  it("hides a mysql -p password", () => {
    expect(redact("mysql -u root -phunter2 billing").text).toBe(
      `mysql -u root -p${REDACTED} billing`,
    );
  });

  it("hides a private key block", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----";
    expect(redact(`echo "${key}" > k`).text).toBe(`echo "${REDACTED}" > k`);
  });

  it("hides known .env values literally, longest first, counting each once", () => {
    const result = redact("curl -u admin:s3cretvalue123 https://x/s3cretvalue123", [
      "s3cretvalue123",
      "short",
    ]);
    expect(result.text).toBe(`curl -u admin:${REDACTED} https://x/${REDACTED}`);
    expect(result.count).toBe(2);
  });

  it("ignores short known values that would wreck the command", () => {
    expect(redact("echo true 1", ["true", "1"]).text).toBe("echo true 1");
  });

  it("is idempotent, so the server can redact again", () => {
    const once = redact("API_TOKEN=abc postgres://a:b@h/d");
    const twice = redact(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.count).toBe(0);
  });

  it("leaves a harmless command untouched", () => {
    expect(redact("npx prisma migrate deploy")).toEqual({
      text: "npx prisma migrate deploy",
      count: 0,
    });
  });
});

describe("truncate", () => {
  it("keeps short text and marks cut text", () => {
    expect(truncate("abc", 10)).toBe("abc");
    const cut = truncate("x".repeat(100), 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("[truncated]")).toBe(true);
  });
});
