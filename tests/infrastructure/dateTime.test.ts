import { describe, expect, it } from "vitest";
import { toSqlDateTime, toSqlDate } from "../../src/infrastructure/db/dateTime";

describe("toSqlDateTime", () => {
  it("converts an ISO timestamp to MySQL DATETIME format", () => {
    expect(toSqlDateTime("2026-09-11T12:31:01.191Z")).toBe("2026-09-11 12:31:01");
  });
});

describe("toSqlDate", () => {
  it("converts an ISO timestamp to MySQL DATE format", () => {
    expect(toSqlDate("2026-09-11T12:31:01.191Z")).toBe("2026-09-11");
  });

  it("converts a date-only ISO string to MySQL DATE format", () => {
    expect(toSqlDate("2026-09-11")).toBe("2026-09-11");
  });
});
