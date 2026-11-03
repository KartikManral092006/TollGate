import { describe, expect, it } from "vitest";
import { lossOf } from "@/features/room/components/context-view";

describe("lossOf", () => {
  it("names the data a line destroys", () => {
    expect(lossOf('ALTER TABLE "invoices" DROP COLUMN "legacy_total";')).toBe(
      "Drops a column and every value in it",
    );
    expect(lossOf("TRUNCATE audit_log;")).toBe("Empties a table");
    expect(lossOf("DELETE FROM sessions;")).toBe("Deletes every row in a table (no WHERE)");
  });

  it("leaves safe lines alone", () => {
    expect(lossOf("CREATE INDEX invoices_due ON invoices (due_at);")).toBeNull();
    expect(lossOf("DELETE FROM sessions WHERE expired;")).toBeNull();
    expect(lossOf("Last commit: 01db5a2 Drop legacy_total")).toBeNull();
  });
});
