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

describe("users routes", () => {
  it("rejects unauthenticated and non-admin access", async () => {
    const unauth = await ctx.app.inject({ method: "GET", url: "/api/v1/users" });
    expect(unauth.statusCode).toBe(401);

    const operator = await createOperator(ctx);
    const forbidden = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: authHeader(operator.token),
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("creates, lists, gets, updates, and deactivates a user as admin", async () => {
    const email = `route-user-${Date.now()}@example.com`;
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authHeader(ctx.adminToken),
      payload: {
        fullName: "Route Test User",
        email,
        password: "StrongPassw0rd!",
        role: "LOCATION_OPERATOR",
        locationIds: [locationId],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const user = createRes.json().data;
    expect(user).not.toHaveProperty("passwordHash");

    const listRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/users?search=${encodeURIComponent(email)}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(listRes.json().data.some((u: { id: string }) => u.id === user.id)).toBe(true);

    const byRoleRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/users?role=LOCATION_OPERATOR&isActive=true&search=${encodeURIComponent(email)}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(byRoleRes.json().data.some((u: { id: string }) => u.id === user.id)).toBe(true);

    const byWrongRoleRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/users?role=ADMIN&search=${encodeURIComponent(email)}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(byWrongRoleRes.json().data.some((u: { id: string }) => u.id === user.id)).toBe(false);

    const getRes = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/users/${user.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(getRes.json().data.fullName).toBe("Route Test User");

    const patchRes = await ctx.app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user.id}`,
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "Renamed User" },
    });
    expect(patchRes.json().data.fullName).toBe("Renamed User");

    const deactivateRes = await ctx.app.inject({
      method: "POST",
      url: `/api/v1/users/${user.id}/deactivate`,
      headers: authHeader(ctx.adminToken),
    });
    expect(deactivateRes.statusCode).toBe(204);

    const afterDeactivate = await ctx.app.inject({
      method: "GET",
      url: `/api/v1/users/${user.id}`,
      headers: authHeader(ctx.adminToken),
    });
    expect(afterDeactivate.json().data.isActive).toBe(false);
  });

  it("returns a validation error for an invalid payload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authHeader(ctx.adminToken),
      payload: { fullName: "X", email: "not-an-email", password: "short", role: "ADMIN" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/users/00000000-0000-0000-0000-000000000000",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(404);
  });
});
