import { v4 as uuid } from "uuid";
import {
  AssessmentRepository,
  AssessmentFilters,
} from "../../domain/repositories/assessmentRepository";
import { StudentRepository } from "../../domain/repositories/studentRepository";
import { QuranRepository } from "../../domain/repositories/quranRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import {
  AssessmentGrade,
  AssessmentType,
  MemorizationAssessment,
  MemorizationAssessmentWithTarget,
} from "../../domain/entities/assessment";
import { computeDayNumber, computeTargetStatus, TargetStatus } from "../../domain/entities/dailyTarget";
import {
  validateAssessmentDate,
  validateAssessmentRange,
} from "../../domain/value-objects/assessmentRange";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";

export interface CreateAssessmentInput {
  assessmentDate: string;
  assessmentType: AssessmentType;
  startSurahNumber: number;
  startVerseNumber: number;
  endSurahNumber: number;
  endVerseNumber: number;
  grade: AssessmentGrade;
  notes?: string | null;
}

export interface UpdateAssessmentInput {
  assessmentDate?: string;
  assessmentType?: AssessmentType;
  startSurahNumber?: number;
  startVerseNumber?: number;
  endSurahNumber?: number;
  endVerseNumber?: number;
  grade?: AssessmentGrade;
  notes?: string | null;
}

export type PublicAssessment = MemorizationAssessmentWithTarget & { targetStatus: TargetStatus };

function toPublicAssessment(assessment: MemorizationAssessmentWithTarget): PublicAssessment {
  return {
    ...assessment,
    targetStatus: computeTargetStatus(
      assessment.endSurahNumber,
      assessment.endVerseNumber,
      assessment.targetEndSurahNumber,
      assessment.targetEndVerseNumber,
    ),
  };
}

export class AssessmentUseCases {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly students: StudentRepository,
    private readonly quran: QuranRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
    private readonly clockSkewMinutes: number,
  ) {}

  private async loadScopedStudent(auth: AuthContext, studentId: string) {
    const student = await this.students.findById(studentId);
    if (!student || student.deletedAt) throw AppError.notFound("Student not found.");
    assertLocationScope(auth, student.locationId);
    return student;
  }

  private async loadScopedAssessment(auth: AuthContext, assessmentId: string) {
    const assessment = await this.assessments.findById(assessmentId);
    if (!assessment || assessment.deletedAt) throw AppError.notFound("Assessment not found.");
    assertLocationScope(auth, assessment.locationId);
    return assessment;
  }

  async listForStudent(
    auth: AuthContext,
    studentId: string,
    filters: Omit<AssessmentFilters, "studentId">,
    page: PageRequest,
  ): Promise<ListResult<PublicAssessment>> {
    await this.loadScopedStudent(auth, studentId);
    const result = await this.assessments.list({ ...filters, studentId }, page);
    return { data: result.data.map(toPublicAssessment), meta: result.meta };
  }

  async listForLocation(
    auth: AuthContext,
    locationId: string,
    filters: Omit<AssessmentFilters, "studentId" | "locationId" | "locationIds">,
    page: PageRequest,
  ): Promise<ListResult<PublicAssessment>> {
    assertLocationScope(auth, locationId);
    const result = await this.assessments.list({ ...filters, locationId }, page);
    return { data: result.data.map(toPublicAssessment), meta: result.meta };
  }

  async getById(auth: AuthContext, id: string): Promise<PublicAssessment> {
    return toPublicAssessment(await this.loadScopedAssessment(auth, id));
  }

  async create(
    auth: AuthContext,
    studentId: string,
    input: CreateAssessmentInput,
  ): Promise<PublicAssessment> {
    const student = await this.loadScopedStudent(auth, studentId);

    validateAssessmentDate(input.assessmentDate, this.clock.nowIso(), this.clockSkewMinutes);
    validateAssessmentRange(
      { surahNumber: input.startSurahNumber, verseNumber: input.startVerseNumber },
      { surahNumber: input.endSurahNumber, verseNumber: input.endVerseNumber },
      this.quran,
    );

    const now = this.clock.nowIso();
    const assessment: MemorizationAssessment = {
      id: uuid(),
      studentId,
      locationId: student.locationId,
      assessmentDate: input.assessmentDate,
      dayNumber: computeDayNumber(input.assessmentDate, student.programStartDate),
      assessmentType: input.assessmentType,
      startSurahNumber: input.startSurahNumber,
      startVerseNumber: input.startVerseNumber,
      endSurahNumber: input.endSurahNumber,
      endVerseNumber: input.endVerseNumber,
      grade: input.grade,
      notes: input.notes ?? null,
      assessorUserId: auth.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.assessments.create(assessment);
    await this.assessments.addRevision({
      id: uuid(),
      assessmentId: assessment.id,
      changedByUserId: auth.userId,
      changeType: "CREATE",
      previousValue: null,
      newValue: assessment as unknown as Record<string, unknown>,
      createdAt: now,
    });
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ASSESSMENT_CREATE",
      resourceType: "memorization_assessment",
      resourceId: assessment.id,
      context: { studentId },
      createdAt: now,
    });

    return toPublicAssessment((await this.assessments.findById(assessment.id))!);
  }

  async update(
    auth: AuthContext,
    id: string,
    input: UpdateAssessmentInput,
  ): Promise<PublicAssessment> {
    const existing = await this.loadScopedAssessment(auth, id);

    const next = {
      assessmentDate: input.assessmentDate ?? existing.assessmentDate,
      assessmentType: input.assessmentType ?? existing.assessmentType,
      startSurahNumber: input.startSurahNumber ?? existing.startSurahNumber,
      startVerseNumber: input.startVerseNumber ?? existing.startVerseNumber,
      endSurahNumber: input.endSurahNumber ?? existing.endSurahNumber,
      endVerseNumber: input.endVerseNumber ?? existing.endVerseNumber,
      grade: input.grade ?? existing.grade,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    validateAssessmentDate(next.assessmentDate, this.clock.nowIso(), this.clockSkewMinutes);
    validateAssessmentRange(
      { surahNumber: next.startSurahNumber, verseNumber: next.startVerseNumber },
      { surahNumber: next.endSurahNumber, verseNumber: next.endVerseNumber },
      this.quran,
    );

    const student = await this.students.findById(existing.studentId);
    const dayNumber = computeDayNumber(next.assessmentDate, student?.programStartDate ?? null);

    const now = this.clock.nowIso();
    const patch = { ...next, dayNumber, updatedAt: now };
    await this.assessments.update(id, patch);

    await this.assessments.addRevision({
      id: uuid(),
      assessmentId: id,
      changedByUserId: auth.userId,
      changeType: "UPDATE",
      previousValue: existing as unknown as Record<string, unknown>,
      newValue: { ...existing, ...patch } as unknown as Record<string, unknown>,
      createdAt: now,
    });
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ASSESSMENT_UPDATE",
      resourceType: "memorization_assessment",
      resourceId: id,
      context: null,
      createdAt: now,
    });

    return toPublicAssessment((await this.assessments.findById(id))!);
  }

  async archive(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.loadScopedAssessment(auth, id);
    const now = this.clock.nowIso();

    await this.assessments.archive(id);
    await this.assessments.addRevision({
      id: uuid(),
      assessmentId: id,
      changedByUserId: auth.userId,
      changeType: "ARCHIVE",
      previousValue: existing as unknown as Record<string, unknown>,
      newValue: { ...existing, deletedAt: now } as unknown as Record<string, unknown>,
      createdAt: now,
    });
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ASSESSMENT_ARCHIVE",
      resourceType: "memorization_assessment",
      resourceId: id,
      context: null,
      createdAt: now,
    });
  }
}
