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

describe("activities routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/activities`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists, gets, updates, and archives an activity as admin", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(ctx.adminToken),
      payload: {
        title: "Route Test Activity",
        activityDate: "2026-01-15",
        photos: [
          { objectKey: "objects/1.jpg", mimeType: "image/jpeg", sizeBytes: 1024, displayOrder: 1 },
        ],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const activity = createRes.json().data;

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.json().data.some((a: { id: string }) => a.id === activity.id)).toBe(true);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/activities/${activity.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data.title).toBe("Route Test Activity");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/activities/${activity.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { title: "Renamed Activity" },
    });
    expect(patchRes.json().data.title).toBe("Renamed Activity");

    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: `/api/v1/activities/${activity.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const afterDelete = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/activities/${activity.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it("rejects create for a non-admin operator", async () => {
    const operator = await createOperator(ctx, [locationId]);
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(operator.token),
      payload: { title: "X", activityDate: "2026-01-15", photos: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects listForLocation for an operator outside the location scope", async () => {
    const operator = await createOperator(ctx, []);
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns signed photo URLs for an activity", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(ctx.adminToken),
      payload: {
        title: "Activity With Photos",
        activityDate: "2026-01-15",
        photos: [
          { objectKey: "objects/2.jpg", mimeType: "image/jpeg", sizeBytes: 1024, displayOrder: 0 },
        ],
      },
    });
    const activity = createRes.json().data;

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/activities/${activity.id}/photos`,
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].url).toContain("http");
  });

  it("rejects photos for an operator outside the location scope", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(ctx.adminToken),
      payload: { title: "X", activityDate: "2026-01-15", photos: [] },
    });
    const activity = createRes.json().data;
    const operator = await createOperator(ctx, []);

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/activities/${activity.id}/photos`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a validation error for an unsupported photo MIME type", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/locations/${locationId}/activities`,
      headers: authHeader(ctx.adminToken),
      payload: {
        title: "X",
        activityDate: "2026-01-15",
        photos: [{ objectKey: "k", mimeType: "application/zip", sizeBytes: 10, displayOrder: 0 }],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
