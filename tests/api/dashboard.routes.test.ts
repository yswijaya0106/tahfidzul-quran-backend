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
  locationId = await createLocationRow(ctx.pool);
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
});
