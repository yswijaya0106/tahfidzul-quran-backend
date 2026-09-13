import { v4 as uuid } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setupTestApp,
  createOperator,
  createLocationRow,
  createStudentRow,
  authHeader,
  TestContext,
} from "./testHelpers";

let ctx: TestContext;
let locationId: string;
let studentId: string;

beforeAll(async () => {
  ctx = await setupTestApp();
  locationId = await createLocationRow(ctx.pool, { kabKota: "Kota Test" });
  studentId = await createStudentRow(ctx.pool, locationId);
});

afterAll(async () => {
  await ctx.app.close();
  await ctx.pool.end();
});

describe("dashboard routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/dashboard/locations/${locationId}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns a location dashboard with default range", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/dashboard/locations/${locationId}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.timezone).toBe("UTC");
    expect(res.json().data.data.activeStudentCount).toBeGreaterThanOrEqual(1);
  });

  it("returns a location dashboard with a custom range and timezone", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/dashboard/locations/${locationId}?from=2026-01-01&to=2026-01-31&timezone=Asia/Jakarta`,
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.timezone).toBe("Asia/Jakarta");
    expect(res.json().data.range).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("rejects a location dashboard for an operator outside the location scope", async () => {
    const operator = await createOperator(ctx, []);
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/dashboard/locations/${locationId}`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a student dashboard", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/dashboard/students/${studentId}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.data).toHaveProperty("history");
  });

  it("returns 404 for a nonexistent student dashboard", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/students/00000000-0000-0000-0000-000000000000",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a per-location submission overview for an admin", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/overview",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json().data.data as { locationId: string; kabKota: string | null }[];
    expect(rows.some((l) => l.locationId === locationId)).toBe(true);
    expect(rows.find((l) => l.locationId === locationId)?.kabKota).toBe("Kota Test");
  });

  it("accepts an explicit date for the overview", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/overview?date=2026-01-01",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.date).toBe("2026-01-01");
  });

  it("rejects the locations overview for a non-admin", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/dashboard/overview",
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  describe("today activity photos", () => {
    const today = new Date().toISOString().slice(0, 10);

    async function insertActivityWithPhotos(
      title: string,
      photoUrls: string[],
      locId: string = locationId,
    ) {
      const activityId = uuid();
      await ctx.pool.query(
        `INSERT INTO activities
          (id, location_id, title, activity_date, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [activityId, locId, title, today, ctx.adminId],
      );
      for (const [index, url] of photoUrls.entries()) {
        await ctx.pool.query(
          `INSERT INTO activity_photos
            (id, activity_id, object_key, caption, display_order, processing_status, created_at)
           VALUES (?, ?, ?, ?, ?, 'READY', DATE_ADD(NOW(), INTERVAL ? SECOND))`,
          [uuid(), activityId, url, `caption ${index}`, index, index],
        );
      }
      return activityId;
    }

    it("returns today's activity photos across locations, newest upload first", async () => {
      await insertActivityWithPhotos("Kajian Pagi", [
        "https://example.com/photo-a1.jpg",
        "https://example.com/photo-a2.jpg",
      ]);

      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/today-activity-photos",
        headers: authHeader(ctx.adminToken),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as {
        photoUrl: string;
        activityTitle: string;
        locationId: string;
        locationName: string;
        uploadedAt: string;
      }[];
      const ours = rows.filter(
        (r) => r.activityTitle === "Kajian Pagi" && r.locationId === locationId,
      );
      expect(ours).toHaveLength(2);
      const [newest, oldest] = ours;
      expect(newest!.photoUrl).toBe("https://example.com/photo-a2.jpg");
      expect(oldest!.photoUrl).toBe("https://example.com/photo-a1.jpg");
      expect(newest!.locationName).toBeTruthy();
      expect(new Date(newest!.uploadedAt).getTime()).toBeGreaterThan(
        new Date(oldest!.uploadedAt).getTime(),
      );
    });

    it("rejects the today activity photos endpoint for a non-admin", async () => {
      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/today-activity-photos",
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });

    it("lets a location operator view their own location's activity photos", async () => {
      await insertActivityWithPhotos("Kajian Sore", ["https://example.com/photo-b1.jpg"]);
      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/today-activity-photos?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as { locationId: string }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.locationId === locationId)).toBe(true);
    });

    it("rejects a location-scoped activity photos request for an operator assigned elsewhere", async () => {
      const otherLocationId = await createLocationRow(ctx.pool, { kabKota: "Kota Lain" });
      const operator = await createOperator(ctx, [otherLocationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/today-activity-photos?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("memorization progress", () => {
    const today = new Date().toISOString().slice(0, 10);

    async function insertAssessment(
      studentId: string,
      endSurahNumber: number,
      endVerseNumber: number,
      dayNumber: number | null = null,
    ) {
      await ctx.pool.query(
        `INSERT INTO memorization_assessments
          (id, student_id, location_id, assessment_date, day_number, assessment_type,
           start_surah_number, start_verse_number, end_surah_number, end_verse_number,
           grade, assessor_user_id)
         VALUES (?, ?, ?, ?, ?, 'NEW_MEMORIZATION', 1, 1, ?, ?, 'MUMTAZ', ?)`,
        [
          uuid(),
          studentId,
          locationId,
          today,
          dayNumber,
          endSurahNumber,
          endVerseNumber,
          ctx.adminId,
        ],
      );
    }

    it("reports REACHED, NOT_REACHED, and NO_TARGET_DATA for today's submissions", async () => {
      const reachedStudentId = await createStudentRow(ctx.pool, locationId, "Reached Student");
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        reachedStudentId,
      ]);
      await insertAssessment(reachedStudentId, 2, 20, 1);

      const notReachedStudentId = await createStudentRow(
        ctx.pool,
        locationId,
        "Not Reached Student",
      );
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        notReachedStudentId,
      ]);
      await insertAssessment(notReachedStudentId, 1, 5, 1);

      const noTargetStudentId = await createStudentRow(ctx.pool, locationId, "No Target Student");
      await insertAssessment(noTargetStudentId, 1, 5);

      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/memorization-progress",
        headers: authHeader(ctx.adminToken),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as {
        studentId: string;
        targetStatus: string;
        kabKota: string | null;
      }[];
      expect(rows.find((r) => r.studentId === reachedStudentId)?.kabKota).toBe("Kota Test");
      expect(rows.find((r) => r.studentId === reachedStudentId)?.targetStatus).toBe("REACHED");
      expect(rows.find((r) => r.studentId === notReachedStudentId)?.targetStatus).toBe(
        "NOT_REACHED",
      );
      expect(rows.find((r) => r.studentId === noTargetStudentId)?.targetStatus).toBe(
        "NO_TARGET_DATA",
      );
    });

    it("rejects the memorization progress endpoint for a non-admin", async () => {
      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/memorization-progress",
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });

    it("lets a location operator view their own location's memorization progress", async () => {
      const studentId = await createStudentRow(ctx.pool, locationId, "Scoped Student");
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        studentId,
      ]);
      await insertAssessment(studentId, 1, 5, 1);

      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/memorization-progress?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as { locationId: string }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.locationId === locationId)).toBe(true);
    });

    it("rejects a location-scoped memorization progress request for an operator assigned elsewhere", async () => {
      const otherLocationId = await createLocationRow(ctx.pool, { kabKota: "Kota Lain" });
      const operator = await createOperator(ctx, [otherLocationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/memorization-progress?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("leaderboard", () => {
    const today = new Date().toISOString().slice(0, 10);

    async function insertNewMemorization(
      studentId: string,
      endSurahNumber: number,
      endVerseNumber: number,
      dayNumber: number | null,
      assessmentDate: string = today,
    ) {
      await ctx.pool.query(
        `INSERT INTO memorization_assessments
          (id, student_id, location_id, assessment_date, day_number, assessment_type,
           start_surah_number, start_verse_number, end_surah_number, end_verse_number,
           grade, assessor_user_id)
         VALUES (?, ?, ?, ?, ?, 'NEW_MEMORIZATION', 1, 1, ?, ?, 'MUMTAZ', ?)`,
        [
          uuid(),
          studentId,
          locationId,
          assessmentDate,
          dayNumber,
          endSurahNumber,
          endVerseNumber,
          ctx.adminId,
        ],
      );
    }

    it("ranks students by how far ahead of the daily target they are (DAILY scope)", async () => {
      const aheadId = await createStudentRow(ctx.pool, locationId, "Leaderboard Ahead");
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        aheadId,
      ]);
      await insertNewMemorization(aheadId, 2, 20, 1);

      const behindId = await createStudentRow(ctx.pool, locationId, "Leaderboard Behind");
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        behindId,
      ]);
      await insertNewMemorization(behindId, 1, 5, 1);

      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/leaderboard?scope=DAILY",
        headers: authHeader(ctx.adminToken),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as {
        studentId: string;
        rank: number;
        deltaVerses: number;
      }[];
      const aheadRow = rows.find((r) => r.studentId === aheadId);
      const behindRow = rows.find((r) => r.studentId === behindId);
      expect(aheadRow).toBeDefined();
      expect(behindRow).toBeDefined();
      expect(aheadRow!.rank).toBeLessThan(behindRow!.rank);
      expect(aheadRow!.deltaVerses).toBeGreaterThan(behindRow!.deltaVerses);
    });

    it("ranks the aggregate leaderboard using each student's furthest-ever position", async () => {
      const studentIdAgg = await createStudentRow(ctx.pool, locationId, "Leaderboard Aggregate");
      await ctx.pool.query("UPDATE students SET program_start_date = ? WHERE id = ?", [
        today,
        studentIdAgg,
      ]);
      // An older, lower assessment followed by a newer, further one — the
      // aggregate leaderboard should use the latest (furthest) position.
      await insertNewMemorization(studentIdAgg, 1, 3, 1, "2000-01-01");
      await insertNewMemorization(studentIdAgg, 2, 20, 1, today);

      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/leaderboard?scope=AGGREGATE",
        headers: authHeader(ctx.adminToken),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as {
        studentId: string;
        achievedEndSurahNumber: number;
        achievedEndVerseNumber: number;
      }[];
      const row = rows.find((r) => r.studentId === studentIdAgg);
      expect(row).toBeDefined();
      expect(row!.achievedEndSurahNumber).toBe(2);
      expect(row!.achievedEndVerseNumber).toBe(20);
    });

    it("defaults to AGGREGATE scope when none is given", async () => {
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/leaderboard",
        headers: authHeader(ctx.adminToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.scope).toBe("AGGREGATE");
    });

    it("rejects the leaderboard endpoint for a non-admin", async () => {
      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/dashboard/leaderboard",
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });

    it("lets a location operator view their own location's leaderboard", async () => {
      const operator = await createOperator(ctx, [locationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/leaderboard?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data.data as { locationId: string }[];
      expect(rows.every((r) => r.locationId === locationId)).toBe(true);
    });

    it("rejects a location-scoped leaderboard for an operator assigned elsewhere", async () => {
      const otherLocationId = await createLocationRow(ctx.pool, { kabKota: "Kota Lain" });
      const operator = await createOperator(ctx, [otherLocationId]);
      const res = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/dashboard/leaderboard?locationId=${locationId}`,
        headers: authHeader(operator.token),
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
