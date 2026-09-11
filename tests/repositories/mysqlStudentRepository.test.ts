import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlStudentRepository } from "../../src/infrastructure/repositories/mysqlStudentRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { Student, StudentDocument } from "../../src/domain/entities/student";

let pool: Pool;
let repo: MysqlStudentRepository;
let locationId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlStudentRepository(pool);
  locationId = await createLocation(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeStudent(overrides: Partial<Student> = {}): Student {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    studentCode: `TQ-${uuid().slice(0, 8)}`,
    fullName: "Repo Test Student",
    locationId,
    nikEncrypted: null,
    guardianName: null,
    address: null,
    studentPhone: null,
    guardianPhone: null,
    studentPhotoObjectKey: null,
    idCardPhotoObjectKey: null,
    graduationCertificateObjectKey: null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlStudentRepository", () => {
  it("creates and finds a student by id and by code", async () => {
    const student = makeStudent();
    await repo.create(student);

    expect((await repo.findById(student.id))?.fullName).toBe(student.fullName);
    expect((await repo.findByStudentCode(student.studentCode))?.id).toBe(student.id);
  });

  it("returns null for a missing id or code", async () => {
    expect(await repo.findById(uuid())).toBeNull();
    expect(await repo.findByStudentCode("NOPE")).toBeNull();
  });

  it("lists students filtered by name, code, phone, status, locationId, locationIds", async () => {
    const marker = uuid().slice(0, 8);
    const student = makeStudent({
      fullName: `Findable ${marker}`,
      studentPhone: `0811${Date.now()}`,
    });
    await repo.create(student);

    expect(
      (await repo.list({ name: marker }, { page: 1, pageSize: 50 })).data.map((s) => s.id),
    ).toEqual([student.id]);
    expect(
      (await repo.list({ studentCode: student.studentCode }, { page: 1, pageSize: 50 })).data.map(
        (s) => s.id,
      ),
    ).toEqual([student.id]);
    expect(
      (await repo.list({ phone: student.studentPhone! }, { page: 1, pageSize: 50 })).data.map(
        (s) => s.id,
      ),
    ).toEqual([student.id]);
    expect(
      (await repo.list({ status: "ACTIVE" }, { page: 1, pageSize: 50 })).data.some(
        (s) => s.id === student.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationId }, { page: 1, pageSize: 50 })).data.some(
        (s) => s.id === student.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationIds: [locationId] }, { page: 1, pageSize: 50 })).data.some(
        (s) => s.id === student.id,
      ),
    ).toBe(true);
    expect(await repo.list({ locationIds: [] }, { page: 1, pageSize: 50 })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
  });

  it("updates student fields", async () => {
    const student = makeStudent();
    await repo.create(student);

    await repo.update(student.id, {
      fullName: "Renamed",
      nikEncrypted: "enc:1234",
      guardianName: "Guardian",
      address: "Addr",
      studentPhone: "0811",
      guardianPhone: "0822",
      studentPhotoObjectKey: "photo-key",
      idCardPhotoObjectKey: "id-key",
      graduationCertificateObjectKey: "cert-key",
      status: "ARCHIVED",
      deletedAt: new Date().toISOString(),
    });

    let found = await repo.findById(student.id);
    expect(found?.fullName).toBe("Renamed");
    expect(found?.status).toBe("ARCHIVED");
    expect(found?.deletedAt).not.toBeNull();

    await repo.update(student.id, { deletedAt: null });
    found = await repo.findById(student.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("does nothing when the update patch is empty", async () => {
    const student = makeStudent();
    await repo.create(student);
    await expect(repo.update(student.id, {})).resolves.toBeUndefined();
  });

  it("archives a student", async () => {
    const student = makeStudent();
    await repo.create(student);
    await repo.archive(student.id);

    const found = await repo.findById(student.id);
    expect(found?.status).toBe("ARCHIVED");
    expect(found?.deletedAt).not.toBeNull();
  });

  it("reports hasAssessments as false when there are none", async () => {
    const student = makeStudent();
    await repo.create(student);
    expect(await repo.hasAssessments(student.id)).toBe(false);
  });

  it("adds and lists documents for a student", async () => {
    const student = makeStudent();
    await repo.create(student);

    const document: StudentDocument = {
      id: uuid(),
      studentId: student.id,
      documentType: "STUDENT_PHOTO",
      objectKey: "objects/photo.jpg",
      originalFileName: "photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    await repo.addDocument(document);

    const documents = await repo.listDocuments(student.id);
    expect(documents).toHaveLength(1);
    expect(documents[0]!.objectKey).toBe("objects/photo.jpg");
  });
});

async function createLocation(pool: Pool): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO locations (id, name, address, status, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, `Location ${id.slice(0, 8)}`, "Street", now, now],
  );
  return id;
}
