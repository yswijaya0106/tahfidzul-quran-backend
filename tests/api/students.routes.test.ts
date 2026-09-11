import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setupTestApp,
  createOperator,
  createLocationRow,
  authHeader,
  TestContext,
} from "./testHelpers";

let ctx: TestContext;
let locationId: string;

beforeAll(async () => {
  ctx = await setupTestApp();
  locationId = await createLocationRow(ctx.pool);
});

afterAll(async () => {
  await ctx.app.close();
  await ctx.pool.end();
});

describe("students routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/students" });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists, gets, updates, and archives a student as admin", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Route Test Student", locationId, nik: "3271010101900001" },
    });
    expect(createRes.statusCode).toBe(201);
    const student = createRes.json().data;
    expect(student.nikMasked).toBe("************0001");

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students?locationId=${locationId}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.json().data.some((s: { id: string }) => s.id === student.id)).toBe(true);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students/${student.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data.fullName).toBe("Route Test Student");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/students/${student.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Renamed Student" },
    });
    expect(patchRes.json().data.fullName).toBe("Renamed Student");

    const archiveRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${student.id}/archive`,
      headers: authHeader(ctx.adminToken),
    });
    expect(archiveRes.statusCode).toBe(204);

    const afterArchive = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students/${student.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(afterArchive.statusCode).toBe(404);
  });

  it("rejects create for a non-admin operator", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(operator.token),
      payload: { fullName: "X", locationId },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a get for a student outside an operator's location scope", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Scoped Student", locationId },
    });
    const student = createRes.json().data;
    const operator = await createOperator(ctx, []);

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students/${student.id}`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a validation error for an invalid payload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "", locationId },
    });
    expect(res.statusCode).toBe(400);
  });
});
