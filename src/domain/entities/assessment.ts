import { Grade } from "./grade";

export type AssessmentType = "NEW_MEMORIZATION" | "MUROJAAH";

/** @deprecated import {Grade} from "./grade" instead; kept as an alias during the transition. */
export type AssessmentGrade = Grade;

export interface QuranPosition {
  surahNumber: number;
  verseNumber: number;
}

export interface MemorizationAssessment {
  id: string;
  studentId: string;
  locationId: string;
  assessmentDate: string;
  /** The student's program day (1-300) on assessmentDate, derived from their
   * program_start_date; null if that date isn't set. FK'd to daily_targets. */
  dayNumber: number | null;
  assessmentType: AssessmentType;
  startSurahNumber: number;
  startVerseNumber: number;
  endSurahNumber: number;
  endVerseNumber: number;
  grade: AssessmentGrade;
  notes: string | null;
  assessorUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Read model: an assessment joined with its daily_targets row (via
 * dayNumber), so callers can tell whether the target was reached. */
export interface MemorizationAssessmentWithTarget extends MemorizationAssessment {
  targetEndSurahNumber: number | null;
  targetEndVerseNumber: number | null;
}

export interface MemorizationAssessmentRevision {
  id: string;
  assessmentId: string;
  changedByUserId: string;
  changeType: "CREATE" | "UPDATE" | "ARCHIVE";
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  createdAt: string;
}
