import { describe, expect, it } from "vitest";
import { AssessmentUseCases } from "../../src/application/assessments/assessmentUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { AppError } from "../../src/domain/errors";
import {
  MemorizationAssessment,
  MemorizationAssessmentRevision,
} from "../../src/domain/entities/assessment";
import { Student } from "../../src/domain/entities/student";
import { QuranSurah } from "../../src/domain/entities/quranSurah";

class FakeAssessmentRepository {
  assessments: MemorizationAssessment[] = [];
  revisions: MemorizationAssessmentRevision[] = [];

  async findById(id: string) {
    return this.assessments.find((a) => a.id === id && !a.deletedAt) ?? null;
  }
  async list() {
    return {
      data: this.assessments,
      meta: { page: 1, pageSize: 20, total: this.assessments.length },
    };
  }
  async create(assessment: MemorizationAssessment) {
    this.assessments.push(assessment);
  }
  async update(id: string, patch: Partial<MemorizationAssessment>) {
    const index = this.assessments.findIndex((a) => a.id === id);
    const existing = this.assessments[index]!;
    this.assessments[index] = { ...existing, ...patch };
  }
  async archive(id: string) {
    const index = this.assessments.findIndex((a) => a.id === id);
    const existing = this.assessments[index]!;
    this.assessments[index] = { ...existing, deletedAt: new Date().toISOString() };
  }
  async addRevision(revision: MemorizationAssessmentRevision) {
    this.revisions.push(revision);
  }
  async listRevisions(assessmentId: string) {
    return this.revisions.filter((r) => r.assessmentId === assessmentId);
  }
  async findLatestForStudent() {
    return null;
  }
}

class FakeStudentRepository {
  constructor(private readonly students: Student[]) {}
  async findById(id: string) {
    return this.students.find((s) => s.id === id) ?? null;
  }
  async findByStudentCode() {
    return null;
  }
  async list() {
    return { data: this.students, meta: { page: 1, pageSize: 20, total: this.students.length } };
  }
  async create() {}
  async update() {}
  async archive() {}
  async hasAssessments() {
    return false;
  }
  async addDocument() {}
  async listDocuments() {
    return [];
  }
}

class FakeQuranRepository {
  private readonly surahs = new Map<number, QuranSurah>([
    [1, { surahNumber: 1, arabicName: "الفاتحة", latinName: "Al-Fatihah", verseCount: 7 }],
    [2, { surahNumber: 2, arabicName: "البقرة", latinName: "Al-Baqarah", verseCount: 286 }],
  ]);
  getBySurahNumber(n: number) {
    return this.surahs.get(n);
  }
  async getBySurahNumberAsync(n: number) {
    return this.surahs.get(n);
  }
  async list() {
    return Array.from(this.surahs.values());
  }
}

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

function buildUseCase(students: Student[]) {
  const assessments = new FakeAssessmentRepository();
  const useCase = new AssessmentUseCases(
    assessments as any,
    new FakeStudentRepository(students) as any,
    new FakeQuranRepository() as any,
    new FakeAuditLogRepository() as any,
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
    5,
  );
  return { useCase, assessments };
}

const student: Student = {
  id: "student-1",
  studentCode: "TQ-0001",
  programStartDate: null,
  fullName: "Test Student",
  locationId: "location-a",
  angkatanId: null,
  nikEncrypted: null,
  guardianName: null,
  address: null,
  studentPhone: null,
  guardianPhone: null,
  studentPhotoObjectKey: null,
  idCardPhotoObjectKey: null,
  graduationCertificateObjectKey: null,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

const validInput = {
  assessmentDate: "2026-01-01T00:00:00.000Z",
  assessmentType: "NEW_MEMORIZATION" as const,
  startSurahNumber: 1,
  startVerseNumber: 1,
  endSurahNumber: 1,
  endVerseNumber: 5,
  grade: "MUMTAZ" as const,
};

describe("AssessmentUseCases", () => {
  it("allows an operator assigned to the student's location to create an assessment", async () => {
    const { useCase } = buildUseCase([student]);
    const operator: AuthContext = {
      userId: "operator-1",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-a"],
    };

    const result = await useCase.create(operator, student.id, validInput);
    expect(result.locationId).toBe("location-a");
    expect(result.assessorUserId).toBe("operator-1");
  });

  it("returns 403 for an operator not assigned to the student's location", async () => {
    const { useCase } = buildUseCase([student]);
    const operator: AuthContext = {
      userId: "operator-2",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-b"],
    };

    await expect(useCase.create(operator, student.id, validInput)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects a range that exceeds the surah's verse count", async () => {
    const { useCase } = buildUseCase([student]);
    const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };

    await expect(
      useCase.create(admin, student.id, { ...validInput, endVerseNumber: 999 }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("records a revision on create and archive", async () => {
    const { useCase, assessments } = buildUseCase([student]);
    const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };

    const created = await useCase.create(admin, student.id, validInput);
    await useCase.archive(admin, created.id);

    const revisions = await assessments.listRevisions(created.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["CREATE", "ARCHIVE"]);
  });

  it("rejects create for a missing or soft-deleted student", async () => {
    const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
    const { useCase: withMissing } = buildUseCase([student]);
    await expect(withMissing.create(admin, "missing", validInput)).rejects.toMatchObject({
      status: 404,
    });

    const deletedStudent = { ...student, id: "student-2", deletedAt: "2026-01-01T00:00:00.000Z" };
    const { useCase: withDeleted } = buildUseCase([deletedStudent]);
    await expect(withDeleted.create(admin, deletedStudent.id, validInput)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("updates an assessment overriding grade and notes, keeping unspecified fields", async () => {
    const { useCase } = buildUseCase([student]);
    const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };

    const created = await useCase.create(admin, student.id, { ...validInput, notes: "original" });
    const updated = await useCase.update(admin, created.id, { grade: "JAYYID", notes: "updated" });

    expect(updated.grade).toBe("JAYYID");
    expect(updated.notes).toBe("updated");
    expect(updated.startSurahNumber).toBe(validInput.startSurahNumber);
  });

  it("updates an assessment without changing grade or notes when omitted", async () => {
    const { useCase } = buildUseCase([student]);
    const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };

    const created = await useCase.create(admin, student.id, { ...validInput, notes: "original" });
    const updated = await useCase.update(admin, created.id, { endVerseNumber: 6 });

    expect(updated.grade).toBe(validInput.grade);
    expect(updated.notes).toBe("original");
    expect(updated.endVerseNumber).toBe(6);
  });

  it("lists daily submissions for a location an operator is assigned to", async () => {
    const { useCase } = buildUseCase([student]);
    const operator: AuthContext = {
      userId: "operator-1",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-a"],
    };

    const result = await useCase.listForLocation(
      operator,
      "location-a",
      {},
      { page: 1, pageSize: 20 },
    );
    expect(result.meta.page).toBe(1);
  });

  it("rejects listing a location's daily submissions for an operator outside its scope", async () => {
    const { useCase } = buildUseCase([student]);
    const operator: AuthContext = {
      userId: "operator-2",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-b"],
    };

    await expect(
      useCase.listForLocation(operator, "location-a", {}, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
