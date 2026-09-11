import { describe, expect, it } from "vitest";
import {
  comparePositions,
  validateAssessmentDate,
  validateAssessmentRange,
} from "../../src/domain/value-objects/assessmentRange";
import { QuranSurah } from "../../src/domain/entities/quranSurah";
import { AppError } from "../../src/domain/errors";

const surahs = new Map<number, QuranSurah>([
  [1, { surahNumber: 1, arabicName: "الفاتحة", latinName: "Al-Fatihah", verseCount: 7 }],
  [2, { surahNumber: 2, arabicName: "البقرة", latinName: "Al-Baqarah", verseCount: 286 }],
  [114, { surahNumber: 114, arabicName: "الناس", latinName: "An-Nas", verseCount: 6 }],
]);

const lookup = { getBySurahNumber: (n: number) => surahs.get(n) };

describe("comparePositions", () => {
  it("orders verses within the same surah", () => {
    expect(
      comparePositions({ surahNumber: 1, verseNumber: 1 }, { surahNumber: 1, verseNumber: 2 }),
    ).toBeLessThan(0);
  });

  it("orders across surahs by surah number first", () => {
    expect(
      comparePositions({ surahNumber: 1, verseNumber: 7 }, { surahNumber: 2, verseNumber: 1 }),
    ).toBeLessThan(0);
  });
});

describe("validateAssessmentRange", () => {
  it("accepts a valid range within one surah", () => {
    expect(() =>
      validateAssessmentRange(
        { surahNumber: 1, verseNumber: 1 },
        { surahNumber: 1, verseNumber: 7 },
        lookup,
      ),
    ).not.toThrow();
  });

  it("rejects an unknown surah number", () => {
    expect(() =>
      validateAssessmentRange(
        { surahNumber: 200, verseNumber: 1 },
        { surahNumber: 1, verseNumber: 1 },
        lookup,
      ),
    ).toThrow(AppError);
  });

  it("rejects a verse number beyond the surah's verse count", () => {
    expect(() =>
      validateAssessmentRange(
        { surahNumber: 1, verseNumber: 1 },
        { surahNumber: 1, verseNumber: 8 },
        lookup,
      ),
    ).toThrow(AppError);
  });

  it("rejects an end position preceding the start position", () => {
    expect(() =>
      validateAssessmentRange(
        { surahNumber: 2, verseNumber: 5 },
        { surahNumber: 1, verseNumber: 1 },
        lookup,
      ),
    ).toThrow(AppError);
  });

  it("accepts the boundary rows 1 and 114", () => {
    expect(() =>
      validateAssessmentRange(
        { surahNumber: 1, verseNumber: 1 },
        { surahNumber: 114, verseNumber: 6 },
        lookup,
      ),
    ).not.toThrow();
  });
});

describe("validateAssessmentDate", () => {
  it("accepts a date within the clock-skew window", () => {
    const now = "2026-01-01T00:00:00.000Z";
    expect(() => validateAssessmentDate("2026-01-01T00:02:00.000Z", now, 5)).not.toThrow();
  });

  it("rejects a date beyond the clock-skew window", () => {
    const now = "2026-01-01T00:00:00.000Z";
    expect(() => validateAssessmentDate("2026-01-01T00:10:00.000Z", now, 5)).toThrow(AppError);
  });

  it("rejects an invalid date string", () => {
    expect(() => validateAssessmentDate("not-a-date", new Date().toISOString(), 5)).toThrow(
      AppError,
    );
  });
});
