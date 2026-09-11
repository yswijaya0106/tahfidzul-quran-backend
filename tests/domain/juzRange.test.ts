import { describe, expect, it } from "vitest";
import { validateJuzRange, validateScore } from "../../src/domain/value-objects/juzRange";
import { AppError } from "../../src/domain/errors";

describe("validateJuzRange", () => {
  it("accepts a valid range", () => {
    expect(() => validateJuzRange(1, 5)).not.toThrow();
    expect(() => validateJuzRange(10, 10)).not.toThrow();
    expect(() => validateJuzRange(1, 30)).not.toThrow();
  });

  it("rejects juzFrom or juzTo outside 1-30", () => {
    expect(() => validateJuzRange(0, 5)).toThrow(AppError);
    expect(() => validateJuzRange(1, 31)).toThrow(AppError);
    expect(() => validateJuzRange(1.5, 5)).toThrow(AppError);
  });

  it("rejects when juzTo precedes juzFrom", () => {
    expect(() => validateJuzRange(10, 5)).toThrow(/juzTo must not precede/);
  });

  it("reports both fields when both are invalid", () => {
    try {
      validateJuzRange(0, 999);
      throw new Error("expected validateJuzRange to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).fields).toMatchObject({
        juzFrom: expect.any(String),
        juzTo: expect.any(String),
      });
    }
  });
});

describe("validateScore", () => {
  it("accepts a score within 0-100", () => {
    expect(() => validateScore(0)).not.toThrow();
    expect(() => validateScore(100)).not.toThrow();
    expect(() => validateScore(87.5)).not.toThrow();
  });

  it("rejects a score outside 0-100 or NaN", () => {
    expect(() => validateScore(-1)).toThrow(AppError);
    expect(() => validateScore(101)).toThrow(AppError);
    expect(() => validateScore(Number.NaN)).toThrow(AppError);
  });
});
