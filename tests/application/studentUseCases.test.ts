import { describe, expect, it } from "vitest";
import { StudentUseCases } from "../../src/application/students/studentUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { Student } from "../../src/domain/entities/student";
import { Location } from "../../src/domain/entities/location";

class FakeStudentRepository {
  students: Student[] = [];
  async findById(id: string) {
    return this.students.find((s) => s.id === id) ?? null;
  }
  async findByStudentCode() {
    return null;
  }
  async list(_filters?: unknown) {
    return { data: this.students, meta: { page: 1, pageSize: 20, total: this.students.length } };
  }
  async create(student: Student) {
    this.students.push(student);
  }
  async update(id: string, patch: Partial<Student>) {
    const index = this.students.findIndex((s) => s.id === id);
    this.students[index] = { ...this.students[index]!, ...patch };
  }
  async archive(id: string) {
    const index = this.students.findIndex((s) => s.id === id);
    this.students[index] = { ...this.students[index]!, deletedAt: "2026-01-02T00:00:00.000Z" };
  }
  async hasAssessments() {
    return false;
  }
  async addDocument() {}
  async listDocuments() {
    return [];
  }
}

class FakeLocationRepository {
  locations: Location[] = [];
  async findById(id: string) {
    return this.locations.find((l) => l.id === id) ?? null;
  }
  async findActiveByName() {
    return null;
  }
  async list() {
    return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  }
  async create() {}
  async update() {}
  async replaceMembers() {}
  async softDelete() {}
}

class FakeAngkatanRepository {
  async findById() {
    return null;
  }
}

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

class FakeEncryptor {
  encrypt(plain: string) {
    return `enc:${plain}`;
  }
  decrypt(cipher: string) {
    return cipher.replace("enc:", "");
  }
}

class FakeObjectStorage {
  async createSignedDownloadUrl(objectKey: string) {
    return `https://signed.example/${objectKey}`;
  }
}

function buildUseCase() {
  const students = new FakeStudentRepository();
  const locations = new FakeLocationRepository();
  const angkatan = new FakeAngkatanRepository();
  const auditLogs = new FakeAuditLogRepository();
  const useCase = new StudentUseCases(
    students as never,
    locations as never,
    angkatan as never,
    auditLogs as never,
    new FakeEncryptor(),
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
    new FakeObjectStorage() as never,
  );
  return { useCase, students, locations, auditLogs };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

const activeLocation: Location = {
  id: "location-a",
  name: "Location A",
  address: "Street",
  provinsi: null,
  kabKota: null,
  kecamatan: null,
  kodePos: null,
  latitude: null,
  longitude: null,
  phone: null,
  description: null,
  coverPhotoObjectKey: null,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

function makeStudent(
  id: string,
  locationId = "location-a",
  nikEncrypted: string | null = null,
): Student {
  return {
    id,
    studentCode: "TQ-0001",
    programStartDate: null,
    fullName: "Test Student",
    locationId,
    angkatanId: null,
    nikEncrypted,
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
}

describe("StudentUseCases", () => {
  it("scopes list() to assigned locations for an operator", async () => {
    const { useCase, students } = buildUseCase();
    let capturedFilters: unknown;
    students.list = async (filters: unknown) => {
      capturedFilters = filters;
      return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
    };
    await useCase.list(operator, {}, { page: 1, pageSize: 20 });
    expect(capturedFilters).toMatchObject({ locationIds: ["location-a"] });
  });

  it("masks the NIK in list results", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1", "location-a", "enc:1234567890"));
    const result = await useCase.list(admin, {}, { page: 1, pageSize: 20 });
    expect(result.data[0]!.nikMasked).toBe("******7890");
  });

  it("returns null nikMasked when there is no NIK", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1"));
    const result = await useCase.getById(admin, "s1");
    expect(result.nikMasked).toBeNull();
  });

  it("rejects getById for an operator outside the location scope", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1", "location-b"));
    await expect(useCase.getById(operator, "s1")).rejects.toMatchObject({ status: 403 });
  });

  it("throws not found for a missing or deleted student", async () => {
    const { useCase, students } = buildUseCase();
    await expect(useCase.getById(admin, "missing")).rejects.toMatchObject({ status: 404 });

    students.students.push({ ...makeStudent("s2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.getById(admin, "s2")).rejects.toMatchObject({ status: 404 });
  });

  it("exposes the raw entity via getEntityById", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1"));
    const entity = await useCase.getEntityById("s1");
    expect(entity?.id).toBe("s1");
    expect(await useCase.getEntityById("missing")).toBeNull();
  });

  it("creates a student as admin with an encrypted NIK", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      fullName: "New Student",
      locationId: "location-a",
      nik: "1234567890",
    });
    expect(created.fullName).toBe("New Student");
    expect(created.nikMasked).toBe("******7890");
  });

  it("creates a student with a photo and returns a signed download URL", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      fullName: "New Student",
      locationId: "location-a",
      studentPhotoObjectKey: "students/photo-1.jpg",
    });
    expect(created.studentPhotoUrl).toBe("https://signed.example/students/photo-1.jpg");
  });

  it("returns a null photo URL when no photo has been uploaded", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      fullName: "New Student",
      locationId: "location-a",
    });
    expect(created.studentPhotoUrl).toBeNull();
  });

  it("rejects create for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(operator, { fullName: "New Student", locationId: "location-a" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects create with an empty fullName", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await expect(
      useCase.create(admin, { fullName: "   ", locationId: "location-a" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects create when the location is missing, deleted, or inactive", async () => {
    const { useCase, locations } = buildUseCase();
    await expect(
      useCase.create(admin, { fullName: "New Student", locationId: "missing" }),
    ).rejects.toMatchObject({ status: 400 });

    locations.locations.push({ ...activeLocation, id: "loc-inactive", status: "INACTIVE" });
    await expect(
      useCase.create(admin, { fullName: "New Student", locationId: "loc-inactive" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates a student, re-encrypting the NIK, and records an audit log", async () => {
    const { useCase, students, auditLogs } = buildUseCase();
    students.students.push(makeStudent("s1"));

    const updated = await useCase.update(admin, "s1", {
      fullName: "Renamed",
      nik: "9876543210",
      guardianName: "New Guardian",
      address: "New Address",
      studentPhone: "0811",
      guardianPhone: "0822",
    });

    expect(updated.fullName).toBe("Renamed");
    expect(updated.nikMasked).toBe("******3210");
    expect(updated.guardianName).toBe("New Guardian");
    expect(updated.address).toBe("New Address");
    expect(updated.studentPhone).toBe("0811");
    expect(updated.guardianPhone).toBe("0822");
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("updates a student's photo object key", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1"));
    const updated = await useCase.update(admin, "s1", {
      studentPhotoObjectKey: "students/photo-2.jpg",
    });
    expect(updated.studentPhotoUrl).toBe("https://signed.example/students/photo-2.jpg");
  });

  it("clears the NIK when updated to null", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1", "location-a", "enc:1234567890"));
    const updated = await useCase.update(admin, "s1", { nik: null });
    expect(updated.nikMasked).toBeNull();
  });

  it("rejects update for a missing or deleted student", async () => {
    const { useCase, students } = buildUseCase();
    await expect(useCase.update(admin, "missing", { fullName: "X" })).rejects.toMatchObject({
      status: 404,
    });

    students.students.push({ ...makeStudent("s2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.update(admin, "s2", { fullName: "X" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("archives a student and records an audit log", async () => {
    const { useCase, students, auditLogs } = buildUseCase();
    students.students.push(makeStudent("s1"));
    await useCase.archive(admin, "s1");
    expect(students.students[0]!.deletedAt).not.toBeNull();
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects archive for a missing or already-deleted student", async () => {
    const { useCase, students } = buildUseCase();
    await expect(useCase.archive(admin, "missing")).rejects.toMatchObject({ status: 404 });

    students.students.push({ ...makeStudent("s2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.archive(admin, "s2")).rejects.toMatchObject({ status: 404 });
  });
});
