import { v4 as uuid } from "uuid";
import { StudentRepository, StudentFilters } from "../../domain/repositories/studentRepository";
import { LocationRepository } from "../../domain/repositories/locationRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { Student, maskNik } from "../../domain/entities/student";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertAdmin, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";
import { FieldEncryptor } from "./ports";

export interface CreateStudentInput {
  fullName: string;
  locationId: string;
  nik?: string | null;
  guardianName?: string | null;
  address?: string | null;
  studentPhone?: string | null;
  guardianPhone?: string | null;
}

export interface UpdateStudentInput {
  fullName?: string;
  nik?: string | null;
  guardianName?: string | null;
  address?: string | null;
  studentPhone?: string | null;
  guardianPhone?: string | null;
}

export type PublicStudent = Omit<Student, "nikEncrypted"> & { nikMasked: string | null };

function toPublicStudent(student: Student, encryptor: FieldEncryptor): PublicStudent {
  const { nikEncrypted, ...rest } = student;
  const nikPlain = nikEncrypted ? encryptor.decrypt(nikEncrypted) : null;
  return { ...rest, nikMasked: maskNik(nikPlain) };
}

async function generateStudentCode(locationId: string): Promise<string> {
  const locationSuffix = locationId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TQ-${locationSuffix}-${randomSuffix}`;
}

export class StudentUseCases {
  constructor(
    private readonly students: StudentRepository,
    private readonly locations: LocationRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly encryptor: FieldEncryptor,
    private readonly clock: Clock,
  ) {}

  async list(
    auth: AuthContext,
    filters: StudentFilters,
    page: PageRequest,
  ): Promise<ListResult<PublicStudent>> {
    const scoped =
      auth.role === "ADMIN" ? filters : { ...filters, locationIds: auth.assignedLocationIds };
    const result = await this.students.list(scoped, page);
    return {
      data: result.data.map((student) => toPublicStudent(student, this.encryptor)),
      meta: result.meta,
    };
  }

  async getById(auth: AuthContext, id: string): Promise<PublicStudent> {
    const student = await this.students.findById(id);
    if (!student || student.deletedAt) throw AppError.notFound("Student not found.");
    assertLocationScope(auth, student.locationId);
    return toPublicStudent(student, this.encryptor);
  }

  /** Internal accessor for other use cases (e.g. assessments) needing the raw entity. */
  async getEntityById(id: string): Promise<Student | null> {
    return this.students.findById(id);
  }

  async create(auth: AuthContext, input: CreateStudentInput): Promise<PublicStudent> {
    assertAdmin(auth);

    if (input.fullName.trim().length === 0) {
      throw AppError.validation("fullName is required.", { fullName: "Required." });
    }

    const location = await this.locations.findById(input.locationId);
    if (!location || location.deletedAt || location.status !== "ACTIVE") {
      throw AppError.validation("locationId must reference an active location.", {
        locationId: "Invalid location.",
      });
    }

    const now = this.clock.nowIso();
    const student: Student = {
      id: uuid(),
      studentCode: await generateStudentCode(input.locationId),
      fullName: input.fullName,
      locationId: input.locationId,
      nikEncrypted: input.nik ? this.encryptor.encrypt(input.nik) : null,
      guardianName: input.guardianName ?? null,
      address: input.address ?? null,
      studentPhone: input.studentPhone ?? null,
      guardianPhone: input.guardianPhone ?? null,
      studentPhotoObjectKey: null,
      idCardPhotoObjectKey: null,
      graduationCertificateObjectKey: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.students.create(student);
    return toPublicStudent(student, this.encryptor);
  }

  async update(auth: AuthContext, id: string, input: UpdateStudentInput): Promise<PublicStudent> {
    assertAdmin(auth);
    const existing = await this.students.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Student not found.");

    const now = this.clock.nowIso();
    const patch: Partial<Student> = { updatedAt: now };
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.nik !== undefined) {
      patch.nikEncrypted = input.nik ? this.encryptor.encrypt(input.nik) : null;
    }
    if (input.guardianName !== undefined) patch.guardianName = input.guardianName;
    if (input.address !== undefined) patch.address = input.address;
    if (input.studentPhone !== undefined) patch.studentPhone = input.studentPhone;
    if (input.guardianPhone !== undefined) patch.guardianPhone = input.guardianPhone;

    await this.students.update(id, patch);

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "student",
      resourceId: id,
      context: { operation: "update" },
      createdAt: now,
    });

    const updated = await this.students.findById(id);
    return toPublicStudent(updated!, this.encryptor);
  }

  async archive(auth: AuthContext, id: string): Promise<void> {
    assertAdmin(auth);
    const existing = await this.students.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Student not found.");

    await this.students.archive(id);
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "student",
      resourceId: id,
      context: null,
      createdAt: this.clock.nowIso(),
    });
  }
}
