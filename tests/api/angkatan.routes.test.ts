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

describe("angkatan routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/angkatan`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists, gets, updates, and deletes an angkatan as admin", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Angkatan 2024", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
    expect(createRes.statusCode).toBe(201);
    const angkatan = createRes.json().data;
    expect(angkatan.locationId).toBe(locationId);

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.json().data.some((a: { id: string }) => a.id === angkatan.id)).toBe(true);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/angkatan/${angkatan.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data.name).toBe("Angkatan 2024");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/angkatan/${angkatan.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Angkatan 2024 Renamed" },
    });
    expect(patchRes.json().data.name).toBe("Angkatan 2024 Renamed");

    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: `/api/v1/angkatan/${angkatan.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const afterDelete = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/angkatan/${angkatan.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it("rejects create for a non-admin operator", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(operator.token),
      payload: { name: "Operator Attempt", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects listForLocation for an operator outside the location scope", async () => {
    const operator = await createOperator(ctx, []);
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows an operator assigned to the location to list its angkatan", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns a validation error for endDate before startDate", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Bad Range", startDate: "2024-12-31", endDate: "2024-01-01" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a duplicate active name at the same location", async () => {
    await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Duplicate Name", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Duplicate Name", startDate: "2025-01-01", endDate: "2025-12-31" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects deleting an angkatan that still has students assigned", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Angkatan With Students", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
    const angkatan = createRes.json().data;

    const studentRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Angkatan Student", locationId, angkatanId: angkatan.id },
    });
    expect(studentRes.statusCode).toBe(201);
    expect(studentRes.json().data.angkatanId).toBe(angkatan.id);

    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: `/api/v1/angkatan/${angkatan.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(409);
  });

  it("rejects a student whose angkatanId belongs to a different location", async () => {
    const otherLocationId = await createLocationRow(ctx.pool);
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${otherLocationId}/angkatan`,
      headers: authHeader(ctx.adminToken),
      payload: { name: "Other Location Angkatan", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
    const angkatan = createRes.json().data;

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Mismatched Student", locationId, angkatanId: angkatan.id },
    });
    expect(res.statusCode).toBe(400);
  });
});
