import { AppError } from "../errors";
import { QuranPosition } from "../entities/assessment";
import { QuranSurah } from "../entities/quranSurah";

/**
 * Canonical Quran order compares (surahNumber, verseNumber) lexicographically:
 * surah 1 verse 1 precedes surah 1 verse 2, which precedes surah 2 verse 1, etc.
 */
export function comparePositions(a: QuranPosition, b: QuranPosition): number {
  if (a.surahNumber !== b.surahNumber) {
    return a.surahNumber - b.surahNumber;
  }
  return a.verseNumber - b.verseNumber;
}

export interface SurahLookup {
  getBySurahNumber(surahNumber: number): QuranSurah | undefined;
}

/**
 * Converts a Quran position into a single linear verse count from the very
 * start of the Mushaf (surah 1, verse 1 => 1), by summing every preceding
 * surah's verse count plus the verse number within the target surah. This
 * gives a scalar "how far into the Quran" measure so two positions (e.g. a
 * student's achieved position and their daily target) can be compared by
 * magnitude, not just ordinally. Returns null if any surah in the 1..surahNumber
 * range is missing from the lookup (should not happen with a fully-seeded
 * quran_surahs table).
 */
export function cumulativeVerseIndex(surahs: SurahLookup, position: QuranPosition): number | null {
  let total = position.verseNumber;
  for (let surahNumber = 1; surahNumber < position.surahNumber; surahNumber++) {
    const surah = surahs.getBySurahNumber(surahNumber);
    if (!surah) return null;
    total += surah.verseCount;
  }
  return total;
}

/**
 * Validates a start/end assessment range against the canonical Quran reference dataset.
 * Throws AppError.unprocessable with field-level messages when invalid.
 */
export function validateAssessmentRange(
  start: QuranPosition,
  end: QuranPosition,
  surahs: SurahLookup,
): void {
  const fields: Record<string, string> = {};

  const startSurah = surahs.getBySurahNumber(start.surahNumber);
  const endSurah = surahs.getBySurahNumber(end.surahNumber);

  if (!startSurah) {
    fields.startSurahNumber = "Surah number must be between 1 and 114.";
  } else if (start.verseNumber < 1 || start.verseNumber > startSurah.verseCount) {
    fields.startVerseNumber = `Verse number must be between 1 and ${startSurah.verseCount} for this surah.`;
  }

  if (!endSurah) {
    fields.endSurahNumber = "Surah number must be between 1 and 114.";
  } else if (end.verseNumber < 1 || end.verseNumber > endSurah.verseCount) {
    fields.endVerseNumber = `Verse number must be between 1 and ${endSurah.verseCount} for this surah.`;
  }

  if (Object.keys(fields).length > 0) {
    throw AppError.unprocessable("The assessment range is invalid.", fields);
  }

  if (comparePositions(end, start) < 0) {
    throw AppError.unprocessable("The end position must not precede the start position.", {
      endSurahNumber: "End position must be at or after the start position.",
    });
  }
}

export function validateAssessmentDate(
  assessmentDateIso: string,
  nowIso: string,
  clockSkewMinutes: number,
): void {
  const assessmentDate = new Date(assessmentDateIso);
  if (Number.isNaN(assessmentDate.getTime())) {
    throw AppError.validation("assessmentDate must be a valid ISO 8601 date.", {
      assessmentDate: "Invalid date.",
    });
  }

  const now = new Date(nowIso);
  const maxAllowed = new Date(now.getTime() + clockSkewMinutes * 60_000);
  if (assessmentDate.getTime() > maxAllowed.getTime()) {
    throw AppError.unprocessable(
      "assessmentDate cannot be later than the allowed clock-skew window.",
      {
        assessmentDate: "Date is too far in the future.",
      },
    );
  }
}
