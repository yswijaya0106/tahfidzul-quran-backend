import { v4 as uuid } from "uuid";
import { IkhtibarRepository, IkhtibarFilters } from "../../domain/repositories/ikhtibarRepository";
import { StudentRepository } from "../../domain/repositories/studentRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { Grade } from "../../domain/entities/grade";
import { Ikhtibar } from "../../domain/entities/ikhtibar";
import { validateJuzRange, validateScore } from "../../domain/value-objects/juzRange";
import { validateAssessmentDate } from "../../domain/value-objects/assessmentRange";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";

export interface CreateIkhtibarInput {
  examDate: string;
  juzFrom: number;
  juzTo: number;
  grade: Grade;
  score: number;
  notes?: string | null;
}

export type UpdateIkhtibarInput = Partial<CreateIkhtibarInput>;

export class IkhtibarUseCases {
  constructor(
    private readonly ikhtibars: IkhtibarRepository,
    private readonly students: StudentRepository,
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

  private async loadScopedIkhtibar(auth: AuthContext, id: string) {
    const ikhtibar = await this.ikhtibars.findById(id);
    if (!ikhtibar || ikhtibar.deletedAt) throw AppError.notFound("Ikhtibar not found.");
    assertLocationScope(auth, ikhtibar.locationId);
    return ikhtibar;
  }

  async listForStudent(
    auth: AuthContext,
    studentId: string,
    filters: Omit<IkhtibarFilters, "studentId">,
    page: PageRequest,
  ): Promise<ListResult<Ikhtibar>> {
    await this.loadScopedStudent(auth, studentId);
    return this.ikhtibars.list({ ...filters, studentId }, page);
  }

  async getById(auth: AuthContext, id: string): Promise<Ikhtibar> {
    return this.loadScopedIkhtibar(auth, id);
  }

  async create(
    auth: AuthContext,
    studentId: string,
    input: CreateIkhtibarInput,
  ): Promise<Ikhtibar> {
    const student = await this.loadScopedStudent(auth, studentId);

    validateAssessmentDate(input.examDate, this.clock.nowIso(), this.clockSkewMinutes);
    validateJuzRange(input.juzFrom, input.juzTo);
    validateScore(input.score);

    const now = this.clock.nowIso();
    const ikhtibar: Ikhtibar = {
      id: uuid(),
      studentId,
      locationId: student.locationId,
      examDate: input.examDate,
      juzFrom: input.juzFrom,
      juzTo: input.juzTo,
      grade: input.grade,
      score: input.score,
      notes: input.notes ?? null,
      assessorUserId: auth.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.ikhtibars.create(ikhtibar);
    await this.ikhtibars.addRevision({
      id: uuid(),
      ikhtibarId: ikhtibar.id,
      changedByUserId: auth.userId,
      changeType: "CREATE",
      previousValue: null,
      newValue: ikhtibar as unknown as Record<string, unknown>,
      createdAt: now,
    });
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ASSESSMENT_CREATE",
      resourceType: "ikhtibar",
      resourceId: ikhtibar.id,
      context: { studentId },
      createdAt: now,
    });

    return ikhtibar;
  }

  async update(auth: AuthContext, id: string, input: UpdateIkhtibarInput): Promise<Ikhtibar> {
    const existing = await this.loadScopedIkhtibar(auth, id);

    const next = {
      examDate: input.examDate ?? existing.examDate,
      juzFrom: input.juzFrom ?? existing.juzFrom,
      juzTo: input.juzTo ?? existing.juzTo,
      grade: input.grade ?? existing.grade,
      score: input.score ?? existing.score,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    validateAssessmentDate(next.examDate, this.clock.nowIso(), this.clockSkewMinutes);
    validateJuzRange(next.juzFrom, next.juzTo);
    validateScore(next.score);

    const now = this.clock.nowIso();
    const patch = { ...next, updatedAt: now };
    await this.ikhtibars.update(id, patch);

    await this.ikhtibars.addRevision({
      id: uuid(),
      ikhtibarId: id,
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
      resourceType: "ikhtibar",
      resourceId: id,
      context: null,
      createdAt: now,
    });

    return { ...existing, ...patch };
  }

  async archive(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.loadScopedIkhtibar(auth, id);
    const now = this.clock.nowIso();

    await this.ikhtibars.archive(id);
    await this.ikhtibars.addRevision({
      id: uuid(),
      ikhtibarId: id,
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
      resourceType: "ikhtibar",
      resourceId: id,
      context: null,
      createdAt: now,
    });
  }
}
