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

const validPayload = {
  examDate: "2026-01-15",
  juzFrom: 1,
  juzTo: 3,
  grade: "MUMTAZ",
  score: 90,
};

describe("ikhtibar routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/ikhtibar`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists, gets, updates, and archives an ikhtibar as admin", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(ctx.adminToken),
      payload: validPayload,
    });
    expect(createRes.statusCode).toBe(201);
    const ikhtibar = createRes.json().data;

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.json().data.some((i: { id: string }) => i.id === ikhtibar.id)).toBe(true);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/ikhtibar/${ikhtibar.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data.grade).toBe("MUMTAZ");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/ikhtibar/${ikhtibar.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { grade: "MAQBUL", score: 55 },
    });
    expect(patchRes.json().data.grade).toBe("MAQBUL");

    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: `/api/v1/ikhtibar/${ikhtibar.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const afterDelete = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/ikhtibar/${ikhtibar.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it("allows an operator assigned to the student's location to create an ikhtibar", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(operator.token),
      payload: validPayload,
    });
    expect(res.statusCode).toBe(201);
  });

  it("rejects create for an operator outside the student's location scope", async () => {
    const operator = await createOperator(ctx, []);
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(operator.token),
      payload: validPayload,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a validation error for an invalid Juz range", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(ctx.adminToken),
      payload: { ...validPayload, juzTo: 999 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns a validation error for a malformed payload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/ikhtibar`,
      headers: authHeader(ctx.adminToken),
      payload: { ...validPayload, grade: "NOT_A_GRADE" },
    });
    expect(res.statusCode).toBe(400);
  });
});
