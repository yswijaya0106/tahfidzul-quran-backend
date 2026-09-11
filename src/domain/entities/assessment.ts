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

export interface MemorizationAssessmentRevision {
  id: string;
  assessmentId: string;
  changedByUserId: string;
  changeType: "CREATE" | "UPDATE" | "ARCHIVE";
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  createdAt: string;
}
