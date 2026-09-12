export type TargetStatus = "REACHED" | "NOT_REACHED" | "NO_TARGET_DATA";

/** A day in the 300-day tahfidz/tilawah program, with its Quran range. */
export interface DailyTarget {
  dayNumber: number;
  startSurahNumber: number;
  startVerseNumber: number;
  endSurahNumber: number;
  endVerseNumber: number;
}

const PROGRAM_LENGTH_DAYS = 300;

/**
 * The student's program day (1-300) for a given assessment date, derived
 * from DATEDIFF(assessmentDate, programStartDate) + 1. Null when the student
 * has no program_start_date on record — there's nothing to derive a day from.
 */
export function computeDayNumber(
  assessmentDate: string,
  programStartDate: string | null,
): number | null {
  if (!programStartDate) return null;
  const diffDays = Math.round(
    (new Date(assessmentDate).getTime() - new Date(programStartDate).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  return Math.min(Math.max(diffDays + 1, 1), PROGRAM_LENGTH_DAYS);
}

/**
 * Reached the target once the achieved end position is at or past the
 * target's end position, comparing surah number first (Quran surahs are
 * numbered in Mushaf/reading order) then verse number within the same surah.
 */
export function computeTargetStatus(
  achievedEndSurahNumber: number,
  achievedEndVerseNumber: number,
  targetEndSurahNumber: number | null,
  targetEndVerseNumber: number | null,
): TargetStatus {
  if (targetEndSurahNumber === null || targetEndVerseNumber === null) return "NO_TARGET_DATA";
  if (achievedEndSurahNumber > targetEndSurahNumber) return "REACHED";
  if (achievedEndSurahNumber < targetEndSurahNumber) return "NOT_REACHED";
  return achievedEndVerseNumber >= targetEndVerseNumber ? "REACHED" : "NOT_REACHED";
}
