import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlDashboardRepository } from "../../src/infrastructure/repositories/mysqlDashboardRepository";
import { MysqlAssessmentRepository } from "../../src/infrastructure/repositories/mysqlAssessmentRepository";
import { MysqlActivityRepository } from "../../src/infrastructure/repositories/mysqlActivityRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { MemorizationAssessment } from "../../src/domain/entities/assessment";
import { Activity } from "../../src/domain/entities/activity";

let pool: Pool;
let repo: MysqlDashboardRepository;
let assessments: MysqlAssessmentRepository;
let activities: MysqlActivityRepository;
let locationId: string;
let studentId: string;
let inactiveStudentId: string;
let userId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlDashboardRepository(pool);
  assessments = new MysqlAssessmentRepository(pool);
  activities = new MysqlActivityRepository(pool);
  locationId = await createLocation(pool);
  userId = await createUser(pool);
  studentId = await createStudent(pool, locationId, "With Assessment");
  inactiveStudentId = await createStudent(pool, locationId, "Without Assessment");

  const now = new Date().toISOString();
  const assessment: MemorizationAssessment = {
    id: uuid(),
    studentId,
    locationId,
    assessmentDate: new Date().toISOString(),
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
  };
  await assessments.create(assessment);

  const activity: Activity = {
    id: uuid(),
    locationId,
    title: "Dashboard Test Activity",
    description: null,
    activityDate: new Date().toISOString().slice(0, 10),
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await activities.create(activity, []);
});

afterAll(async () => {
  await pool.end();
});

describe("MysqlDashboardRepository", () => {
  it("computes a location dashboard for the given range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    const data = await repo.getLocationDashboard(locationId, { from: monthAgo, to: today }, 14);

    expect(data.activeStudentCount).toBeGreaterThanOrEqual(2);
    expect(data.assessmentCount).toBeGreaterThanOrEqual(1);
    expect(data.distributionByGrade.MUMTAZ).toBeGreaterThanOrEqual(1);
    expect(data.distributionByType.NEW_MEMORIZATION).toBeGreaterThanOrEqual(1);
    expect(data.latestAssessmentDate).toBe(today);
    expect(
      data.studentsWithoutRecentAssessment.some((s) => s.studentId === inactiveStudentId),
    ).toBe(true);
    expect(data.studentsWithoutRecentAssessment.some((s) => s.studentId === studentId)).toBe(false);
    expect(data.recentActivities.some((a) => a.title === "Dashboard Test Activity")).toBe(true);
  });

  it("returns an empty distribution when there is no data in range", async () => {
    const data = await repo.getLocationDashboard(
      locationId,
      { from: "2000-01-01", to: "2000-01-02" },
      14,
    );
    expect(data.assessmentCount).toBe(0);
    expect(data.latestAssessmentDate).toBeNull();
  });

  it("computes a student dashboard with latest assessments by type", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    const data = await repo.getStudentDashboard(studentId, { from: monthAgo, to: today });

    expect(data.history.length).toBeGreaterThanOrEqual(1);
    expect(data.distributionByGrade.MUMTAZ).toBeGreaterThanOrEqual(1);
    expect(data.coveredRanges.NEW_MEMORIZATION.length).toBeGreaterThanOrEqual(1);
    expect(data.latestNewMemorization).not.toBeNull();
    expect(data.latestMurojaah).toBeNull();
  });

  it("returns empty history for a student dashboard with no assessments in range", async () => {
    const data = await repo.getStudentDashboard(inactiveStudentId, {
      from: "2000-01-01",
      to: "2000-01-02",
    });
    expect(data.history).toEqual([]);
    expect(data.latestNewMemorization).toBeNull();
    expect(data.latestMurojaah).toBeNull();
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

async function createStudent(pool: Pool, locationId: string, name: string): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO students (id, student_code, full_name, location_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, `TQ-${id.slice(0, 8)}`, name, locationId, now, now],
  );
  return id;
}
