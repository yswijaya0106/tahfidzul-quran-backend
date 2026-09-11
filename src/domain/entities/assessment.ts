export type AssessmentType = "NEW_MEMORIZATION" | "MUROJAAH";

export type AssessmentGrade = "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "NEEDS_REVIEW";

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
