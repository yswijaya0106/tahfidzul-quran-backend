import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlAssessmentRepository } from "../../src/infrastructure/repositories/mysqlAssessmentRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { MemorizationAssessment } from "../../src/domain/entities/assessment";

let pool: Pool;
let repo: MysqlAssessmentRepository;
let locationId: string;
let studentId: string;
let userId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlAssessmentRepository(pool);
  locationId = await createLocation(pool);
  userId = await createUser(pool);
  studentId = await createStudent(pool, locationId);
});

afterAll(async () => {
  await pool.end();
});

function makeAssessment(overrides: Partial<MemorizationAssessment> = {}): MemorizationAssessment {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    studentId,
    locationId,
    assessmentDate: "2026-01-10T00:00:00.000Z",
    assessmentType: "NEW_MEMORIZATION",
    startSurahNumber: 1,
    startVerseNumber: 1,
    endSurahNumber: 1,
    endVerseNumber: 5,
    grade: "MUMTAZ",
    notes: null,
    assessorUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlAssessmentRepository", () => {
  it("creates an assessment and finds it by id (assessmentDate normalized to date-only)", async () => {
    const assessment = makeAssessment();
    await repo.create(assessment);

    const found = await repo.findById(assessment.id);
    expect(found?.assessmentDate).toBe("2026-01-10");
    expect(found?.grade).toBe("MUMTAZ");
  });

  it("returns null for a missing id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("lists assessments filtered by studentId, locationId, locationIds, type, and date range", async () => {
    const assessment = makeAssessment({ assessmentType: "MUROJAAH" });
    await repo.create(assessment);

    expect(
      (await repo.list({ studentId }, { page: 1, pageSize: 50 })).data.some(
        (a) => a.id === assessment.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationId }, { page: 1, pageSize: 50 })).data.some(
        (a) => a.id === assessment.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationIds: [locationId] }, { page: 1, pageSize: 50 })).data.some(
        (a) => a.id === assessment.id,
      ),
    ).toBe(true);
    expect(await repo.list({ locationIds: [] }, { page: 1, pageSize: 50 })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
    expect(
      (await repo.list({ assessmentType: "MUROJAAH" }, { page: 1, pageSize: 50 })).data.some(
        (a) => a.id === assessment.id,
      ),
    ).toBe(true);
    expect(
      (
        await repo.list({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }, { page: 1, pageSize: 50 })
      ).data.some((a) => a.id === assessment.id),
    ).toBe(true);
    expect(
      (
        await repo.list({ dateFrom: "2020-01-01", dateTo: "2020-01-02" }, { page: 1, pageSize: 50 })
      ).data.some((a) => a.id === assessment.id),
    ).toBe(false);
  });

  it("updates assessment fields including clearing deletedAt", async () => {
    const assessment = makeAssessment();
    await repo.create(assessment);

    await repo.update(assessment.id, {
      assessmentDate: "2026-02-01T00:00:00.000Z",
      assessmentType: "MUROJAAH",
      startSurahNumber: 2,
      startVerseNumber: 1,
      endSurahNumber: 2,
      endVerseNumber: 10,
      grade: "JAYYID",
      notes: "note",
      deletedAt: new Date().toISOString(),
    });

    let found = await repo.findById(assessment.id);
    expect(found?.assessmentDate).toBe("2026-02-01");
    expect(found?.grade).toBe("JAYYID");
    expect(found?.deletedAt).not.toBeNull();

    await repo.update(assessment.id, { deletedAt: null });
    found = await repo.findById(assessment.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("does nothing when the update patch is empty", async () => {
    const assessment = makeAssessment();
    await repo.create(assessment);
    await expect(repo.update(assessment.id, {})).resolves.toBeUndefined();
  });

  it("archives an assessment", async () => {
    const assessment = makeAssessment();
    await repo.create(assessment);
    await repo.archive(assessment.id);

    const found = await repo.findById(assessment.id);
    expect(found?.deletedAt).not.toBeNull();
  });

  it("adds and lists revisions for an assessment", async () => {
    const assessment = makeAssessment();
    await repo.create(assessment);

    await repo.addRevision({
      id: uuid(),
      assessmentId: assessment.id,
      changedByUserId: userId,
      changeType: "CREATE",
      previousValue: null,
      newValue: { grade: "MUMTAZ" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await repo.addRevision({
      id: uuid(),
      assessmentId: assessment.id,
      changedByUserId: userId,
      changeType: "UPDATE",
      previousValue: { grade: "MUMTAZ" },
      newValue: { grade: "JAYYID" },
      createdAt: "2026-01-01T00:00:05.000Z",
    });

    const revisions = await repo.listRevisions(assessment.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["CREATE", "UPDATE"]);
    expect(revisions[1]!.previousValue).toEqual({ grade: "MUMTAZ" });
  });

  it("finds the latest assessment for a student by type", async () => {
    const older = makeAssessment({ assessmentDate: "2026-01-01T00:00:00.000Z" });
    const newer = makeAssessment({ assessmentDate: "2026-01-20T00:00:00.000Z" });
    await repo.create(older);
    await repo.create(newer);

    const latest = await repo.findLatestForStudent(studentId, "NEW_MEMORIZATION");
    expect(latest?.id).toBe(newer.id);

    expect(await repo.findLatestForStudent(uuid(), "NEW_MEMORIZATION")).toBeNull();
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

async function createUser(pool: Pool): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 'ADMIN', 1, ?, ?)`,
    [id, "Repo Test Admin", `admin-${id}@example.com`, now, now],
  );
  return id;
}

async function createStudent(pool: Pool, locationId: string): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO students (id, student_code, full_name, location_id, status, created_at, updated_at)
     VALUES (?, ?, 'Repo Test Student', ?, 'ACTIVE', ?, ?)`,
    [id, `TQ-${id.slice(0, 8)}`, locationId, now, now],
  );
  return id;
}
