import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestApp, authHeader, TestContext } from "./testHelpers";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp();
});

afterAll(async () => {
  await ctx.app.close();
  await ctx.pool.end();
});

describe("ref data routes", () => {
  it("rejects unauthenticated requests for provinces", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/ref/provinces" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unauthenticated requests for cities", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/v1/ref/cities" });
    expect(res.statusCode).toBe(401);
  });

  it("lists all provinces", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/ref/provinces",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(33);
    expect(body.data[0]).toHaveProperty("provinceName");
  });

  it("lists all cities when no provinceId filter is given", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/ref/cities",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(420);
  });

  it("filters cities by provinceId", async () => {
    const provincesRes = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/ref/provinces",
      headers: authHeader(ctx.adminToken),
    });
    const provinceId = provincesRes.json().data[0].id;

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/ref/cities?provinceId=${provinceId}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(200);
    const cities = res.json().data as { provinceId: number }[];
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((c) => c.provinceId === provinceId)).toBe(true);
  });

  it("returns a validation error for a non-numeric provinceId", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/ref/cities?provinceId=not-a-number",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(400);
  });
});
