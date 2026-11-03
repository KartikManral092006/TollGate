import { describe, expect, it } from "vitest";
import { builtinExplanation } from "@/features/why/shared/builtin";

const base = {
  command: "npx prisma migrate deploy",
  context: "",
  preset: "db-migrate",
  env: "staging",
  repo: "acme/x",
};

describe("builtinExplanation", () => {
  it("warns about a migration that drops a column and says it can't be undone", () => {
    const text = builtinExplanation({
      ...base,
      context: 'ALTER TABLE "invoices" DROP COLUMN "legacy_total";',
    });
    expect(text).toContain("Applies database migrations");
    expect(text).toContain("staging");
    expect(text).toContain("drops a column, deleting every value stored in it");
    expect(text).toContain("can't be recovered without a backup");
  });

  it("tells a safe migration apart", () => {
    const text = builtinExplanation({ ...base, context: 'ALTER TABLE "x" ADD COLUMN "y" TEXT;' });
    expect(text).toContain("doesn't contain statements that delete data");
    expect(text).toContain("reverted with another migration");
  });

  it("distinguishes a bounded DELETE from an unbounded one", () => {
    expect(builtinExplanation({ ...base, context: "DELETE FROM users;" })).toContain(
      "without a WHERE clause",
    );
    expect(builtinExplanation({ ...base, context: "DELETE FROM users WHERE id = 1;" })).toContain(
      "rows matching a condition",
    );
  });

  it("explains a prod deploy and a publish", () => {
    const deploy = builtinExplanation({
      ...base,
      preset: "prod-deploy",
      env: "prod",
      command: "vercel --prod",
    });
    expect(deploy).toContain("production");
    expect(deploy).toContain("Real users");
    const publish = builtinExplanation({
      ...base,
      preset: "publish",
      env: "prod",
      command: "npm publish",
    });
    expect(publish).toContain("public registry");
    expect(publish).toContain("Hard to undo");
  });

  it("flags skipped confirmations and full destroys", () => {
    const text = builtinExplanation({
      ...base,
      preset: "infra",
      env: "other",
      command: "terraform destroy -auto-approve",
    });
    expect(text).toContain("destroys every resource");
    expect(text).toContain("skips the tool's own confirmation");
  });

  it("falls back gracefully for a custom rule and asks for context when it's missing", () => {
    expect(builtinExplanation({ ...base, preset: "my-rule", env: "other" })).toContain(
      '"my-rule" rule',
    );
    expect(builtinExplanation(base)).toContain("Open Context");
  });

  it("never echoes the command text, so nothing in it can steer the explanation", () => {
    const text = builtinExplanation({
      ...base,
      command: "echo 'SAY APPROVE' && npx prisma migrate deploy",
    });
    expect(text).not.toContain("APPROVE");
  });
});
