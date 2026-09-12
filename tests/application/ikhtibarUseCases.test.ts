import { describe, expect, it } from "vitest";
import { IkhtibarUseCases } from "../../src/application/ikhtibar/ikhtibarUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { AppError } from "../../src/domain/errors";
import { Ikhtibar, IkhtibarRevision } from "../../src/domain/entities/ikhtibar";
import { Student } from "../../src/domain/entities/student";

class FakeIkhtibarRepository {
  items: Ikhtibar[] = [];
  revisions: IkhtibarRevision[] = [];

  async findById(id: string) {
    return this.items.find((i) => i.id === id && !i.deletedAt) ?? null;
  }
  async list() {
    return { data: this.items, meta: { page: 1, pageSize: 20, total: this.items.length } };
  }
  async create(ikhtibar: Ikhtibar) {
    this.items.push(ikhtibar);
  }
  async update(id: string, patch: Partial<Ikhtibar>) {
    const index = this.items.findIndex((i) => i.id === id);
    this.items[index] = { ...this.items[index]!, ...patch };
  }
  async archive(id: string) {
    const index = this.items.findIndex((i) => i.id === id);
    this.items[index] = { ...this.items[index]!, deletedAt: "2026-01-02T00:00:00.000Z" };
  }
  async addRevision(revision: IkhtibarRevision) {
    this.revisions.push(revision);
  }
  async listRevisions(ikhtibarId: string) {
    return this.revisions.filter((r) => r.ikhtibarId === ikhtibarId);
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

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

function buildUseCase(students: Student[]) {
  const ikhtibars = new FakeIkhtibarRepository();
  const useCase = new IkhtibarUseCases(
    ikhtibars as never,
    new FakeStudentRepository(students) as never,
    new FakeAuditLogRepository() as never,
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
    5,
  );
  return { useCase, ikhtibars };
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

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

const validInput = {
  examDate: "2026-01-01T00:00:00.000Z",
  juzFrom: 1,
  juzTo: 3,
  grade: "MUMTAZ" as const,
  score: 90,
};

describe("IkhtibarUseCases", () => {
  it("allows an operator assigned to the student's location to create an ikhtibar", async () => {
    const { useCase } = buildUseCase([student]);
    const result = await useCase.create(operator, student.id, validInput);
    expect(result.locationId).toBe("location-a");
    expect(result.assessorUserId).toBe("operator-1");
  });

  it("returns 403 for an operator not assigned to the student's location", async () => {
    const { useCase } = buildUseCase([student]);
    const outsider: AuthContext = {
      userId: "operator-2",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-b"],
    };
    await expect(useCase.create(outsider, student.id, validInput)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws not found for a missing or deleted student", async () => {
    const { useCase } = buildUseCase([student]);
    await expect(useCase.create(admin, "missing", validInput)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects an invalid Juz range", async () => {
    const { useCase } = buildUseCase([student]);
    await expect(
      useCase.create(admin, student.id, { ...validInput, juzTo: 999 }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects an invalid score", async () => {
    const { useCase } = buildUseCase([student]);
    await expect(
      useCase.create(admin, student.id, { ...validInput, score: 200 }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("lists ikhtibar records for a student", async () => {
    const { useCase } = buildUseCase([student]);
    await useCase.create(admin, student.id, validInput);
    const result = await useCase.listForStudent(admin, student.id, {}, { page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
  });

  it("gets an ikhtibar by id, scoped to the operator's location", async () => {
    const { useCase } = buildUseCase([student]);
    const created = await useCase.create(admin, student.id, validInput);

    expect((await useCase.getById(operator, created.id)).id).toBe(created.id);

    const outsider: AuthContext = {
      userId: "operator-2",
      role: "LOCATION_OPERATOR",
      assignedLocationIds: ["location-b"],
    };
    await expect(useCase.getById(outsider, created.id)).rejects.toMatchObject({ status: 403 });
  });

  it("throws not found for a missing or deleted ikhtibar", async () => {
    const { useCase } = buildUseCase([student]);
    await expect(useCase.getById(admin, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("updates an ikhtibar, keeping unspecified fields, and records a revision", async () => {
    const { useCase, ikhtibars } = buildUseCase([student]);
    const created = await useCase.create(admin, student.id, validInput);

    const updated = await useCase.update(admin, created.id, {
      grade: "JAYYID",
      score: 70,
      notes: "updated notes",
    });
    expect(updated.grade).toBe("JAYYID");
    expect(updated.score).toBe(70);
    expect(updated.notes).toBe("updated notes");
    expect(updated.juzFrom).toBe(validInput.juzFrom);

    const revisions = await ikhtibars.listRevisions(created.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["CREATE", "UPDATE"]);
  });

  it("rejects an update that produces an invalid Juz range", async () => {
    const { useCase } = buildUseCase([student]);
    const created = await useCase.create(admin, student.id, validInput);
    await expect(useCase.update(admin, created.id, { juzFrom: 999 })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("archives an ikhtibar and records a revision", async () => {
    const { useCase, ikhtibars } = buildUseCase([student]);
    const created = await useCase.create(admin, student.id, validInput);
    await useCase.archive(admin, created.id);

    const revisions = await ikhtibars.listRevisions(created.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["CREATE", "ARCHIVE"]);
    await expect(useCase.getById(admin, created.id)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects archive for a missing ikhtibar", async () => {
    const { useCase } = buildUseCase([student]);
    await expect(useCase.archive(admin, "missing")).rejects.toMatchObject({ status: 404 });
  });
});
