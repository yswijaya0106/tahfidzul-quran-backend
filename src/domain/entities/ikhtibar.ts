import { Grade } from "./grade";

/**
 * Ikhtibar: a periodic memorization exam covering a Juz range, scheduled by
 * date, graded on the same scale as daily assessments plus a numeric score.
 * Unlike a MemorizationAssessment (surah/verse level, per teaching session),
 * an Ikhtibar record is per Juz range and is the formal exam result.
 */
export interface Ikhtibar {
  id: string;
  studentId: string;
  locationId: string;
  examDate: string;
  juzFrom: number;
  juzTo: number;
  grade: Grade;
  score: number;
  notes: string | null;
  assessorUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface IkhtibarRevision {
  id: string;
  ikhtibarId: string;
  changedByUserId: string;
  changeType: "CREATE" | "UPDATE" | "ARCHIVE";
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  createdAt: string;
}
