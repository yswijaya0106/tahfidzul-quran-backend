import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { setupTestApp, createOperator, authHeader, TestContext } from "./testHelpers";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp();
});

afterAll(async () => {
  await ctx.app.close();
  await ctx.pool.end();
});

describe("locations routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/locations" });
    expect(res.statusCode).toBe(401);
  });

  it("creates, lists, gets, updates, and deletes a location as admin", async () => {
    const name = `Route Test Location ${uuid()}`;
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(ctx.adminToken),
      payload: { name, address: "Jl. Test No.1" },
    });
    expect(createRes.statusCode).toBe(201);
    const location = createRes.json().data;

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations?status=ACTIVE&search=${encodeURIComponent(name)}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.some((l: { id: string }) => l.id === location.id)).toBe(true);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.name).toBe(name);

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { name: `Renamed ${name}` },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.name).toBe(`Renamed ${name}`);

    const deleteRes = await ctx.app.inject({
      method: "DELETE",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const getAfterDelete = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getAfterDelete.statusCode).toBe(404);
  });

  it("creates and updates a location with structured address fields", async () => {
    const name = `Address Test Location ${uuid()}`;
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(ctx.adminToken),
      payload: {
        name,
        address:
          "Jl. Contoh No. 1, Kelurahan Contoh, Kecamatan Contoh, Kota Contoh, Jawa Barat 40123",
        provinsi: "Jawa Barat",
        kabKota: "Kota Contoh",
        kecamatan: "Kecamatan Contoh",
        kodePos: "40123",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const location = createRes.json().data;
    expect(location).toMatchObject({
      provinsi: "Jawa Barat",
      kabKota: "Kota Contoh",
      kecamatan: "Kecamatan Contoh",
      kodePos: "40123",
    });

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { kodePos: "40199" },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data.kodePos).toBe("40199");
    expect(patchRes.json().data.provinsi).toBe("Jawa Barat");
  });

  it("creates and updates a location with ref_province/ref_city ids and a cover photo", async () => {
    const name = `RefData Location ${uuid()}`;
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(ctx.adminToken),
      payload: {
        name,
        address: "Jl. Contoh No. 2",
        provinceId: 1,
        cityId: 1,
        coverPhotoObjectKey: "locations/cover-1.jpg",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const location = createRes.json().data;
    expect(location).toMatchObject({ provinceId: 1, cityId: 1 });
    expect(location.coverPhotoUrl).toContain("locations/cover-1.jpg");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { cityId: 2, coverPhotoObjectKey: "locations/cover-2.jpg" },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().data).toMatchObject({ provinceId: 1, cityId: 2 });
    expect(patchRes.json().data.coverPhotoUrl).toContain("locations/cover-2.jpg");

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data).toMatchObject({ provinceId: 1, cityId: 2 });
  });

  it("rejects create/update/delete for a non-admin operator", async () => {
    const operator = await createOperator(ctx);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(operator.token),
      payload: { name: `Operator Location ${uuid()}`, address: "Street" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a get for a location outside an operator's scope", async () => {
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(ctx.adminToken),
      payload: { name: `Scoped Location ${uuid()}`, address: "Street" },
    });
    expect(createRes.statusCode).toBe(201);
    const location = createRes.json().data;
    const operator = await createOperator(ctx, []);

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/locations/${location.id}`,
      headers: authHeader(operator.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a validation error for an invalid payload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: authHeader(ctx.adminToken),
      payload: { name: "A", address: "Street" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for a nonexistent location on update", async () => {
    const res = await ctx.app.inject({
      method: "PATCH",
      url: "/api/v1/locations/00000000-0000-0000-0000-000000000000",
      headers: authHeader(ctx.adminToken),
      payload: { name: `Whatever Name ${uuid()}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
