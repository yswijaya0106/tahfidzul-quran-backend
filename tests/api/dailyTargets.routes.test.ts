import { v4 as uuid } from "uuid";
import { RowDataPacket } from "mysql2/promise";
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
// This suite mutates the shared, persistent daily_targets seed (days 2 and
// 300) to exercise update/delete/recreate — snapshot those rows up front and
// restore them afterward so other suites asserting on the canonical 300-day
// schedule (e.g. dailyTargetsSeed.test.ts) aren't left looking at test data.
let day2Snapshot: RowDataPacket;
let day300Snapshot: RowDataPacket;

beforeAll(async () => {
  ctx = await setupTestApp();
  const [[row2]] = await ctx.pool.query<RowDataPacket[]>(
    "SELECT * FROM daily_targets WHERE day_number = 2",
  );
  const [[row300]] = await ctx.pool.query<RowDataPacket[]>(
    "SELECT * FROM daily_targets WHERE day_number = 300",
  );
  day2Snapshot = row2!;
  day300Snapshot = row300!;
});

afterAll(async () => {
  await ctx.pool.query(
    `UPDATE daily_targets
     SET start_surah_number = ?, start_verse_number = ?, end_surah_number = ?, end_verse_number = ?
     WHERE day_number = 2`,
    [
      day2Snapshot.start_surah_number,
      day2Snapshot.start_verse_number,
      day2Snapshot.end_surah_number,
      day2Snapshot.end_verse_number,
    ],
  );
  const [existing300] = await ctx.pool.query<RowDataPacket[]>(
    "SELECT 1 FROM daily_targets WHERE day_number = 300",
  );
  if (existing300.length > 0) {
    await ctx.pool.query(
      `UPDATE daily_targets
       SET start_surah_number = ?, start_verse_number = ?, end_surah_number = ?, end_verse_number = ?
       WHERE day_number = 300`,
      [
        day300Snapshot.start_surah_number,
        day300Snapshot.start_verse_number,
        day300Snapshot.end_surah_number,
        day300Snapshot.end_verse_number,
      ],
    );
  } else {
    await ctx.pool.query(
      `INSERT INTO daily_targets
        (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
       VALUES (300, ?, ?, ?, ?)`,
      [
        day300Snapshot.start_surah_number,
        day300Snapshot.start_verse_number,
        day300Snapshot.end_surah_number,
        day300Snapshot.end_verse_number,
      ],
    );
  }

  await ctx.app.close();
  await ctx.pool.end();
});

describe("daily targets routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/daily-targets" });
    expect(res.statusCode).toBe(401);
  });

  it("lists the seeded 300-day schedule for any authenticated role", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/daily-targets",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(300);
    expect(res.json().data[0]).toMatchObject({ dayNumber: 1 });
  });

  it("returns a single day's target", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/daily-targets/1",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.dayNumber).toBe(1);
  });

  it("returns 404 for a day with no target row", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/daily-targets/999",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects creating a day that already exists", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/daily-targets",
      headers: authHeader(ctx.adminToken),
      payload: {
        dayNumber: 1,
        startSurahNumber: 1,
        startVerseNumber: 1,
        endSurahNumber: 1,
        endVerseNumber: 5,
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects create for a non-admin operator", async () => {
    const operator = await createOperator(ctx);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/daily-targets",
      headers: authHeader(operator.token),
      payload: {
        dayNumber: 1,
        startSurahNumber: 1,
        startVerseNumber: 1,
        endSurahNumber: 1,
        endVerseNumber: 5,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("updates an existing day's target as admin", async () => {
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/v1/daily-targets/2",
      headers: authHeader(ctx.adminToken),
      payload: { endVerseNumber: 25 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.endVerseNumber).toBe(25);
  });

  it("rejects an update with an invalid Quran range", async () => {
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/v1/daily-targets/2",
      headers: authHeader(ctx.adminToken),
      payload: { endSurahNumber: 1, endVerseNumber: 999 },
    });
    expect(res.statusCode).toBe(422);
  });

  it("rejects update for a non-admin operator", async () => {
    const operator = await createOperator(ctx);
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/v1/daily-targets/2",
      headers: authHeader(operator.token),
      payload: { endVerseNumber: 25 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("deletes a day with no referencing assessments, then allows recreating it", async () => {
    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/daily-targets/300",
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/daily-targets/300",
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.statusCode).toBe(404);

    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/daily-targets",
      headers: authHeader(ctx.adminToken),
      payload: {
        dayNumber: 300,
        startSurahNumber: 114,
        startVerseNumber: 1,
        endSurahNumber: 114,
        endVerseNumber: 6,
      },
    });
    expect(createRes.statusCode).toBe(201);
  });

  it("rejects deleting a day that an assessment still references", async () => {
    const locationId = await createLocationRow(ctx.pool);
    const studentId = await createStudentRow(ctx.pool, locationId);
    await ctx.pool.query(
      `INSERT INTO memorization_assessments
        (id, student_id, location_id, assessment_date, day_number, assessment_type,
         start_surah_number, start_verse_number, end_surah_number, end_verse_number,
         grade, assessor_user_id)
       VALUES (?, ?, ?, CURDATE(), 299, 'NEW_MEMORIZATION', 1, 1, 1, 5, 'MUMTAZ', ?)`,
      [uuid(), studentId, locationId, ctx.adminId],
    );

    const res = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/daily-targets/299",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects delete for a non-admin operator", async () => {
    const operator = await createOperator(ctx);
    const res = await ctx.app.inject({
      method: "DELETE",
      url: "/api/v1/daily-targets/300",
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });
});
