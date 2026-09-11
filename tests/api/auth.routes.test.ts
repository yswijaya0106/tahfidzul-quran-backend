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

describe("auth routes", () => {
  it("rejects logout and logout-all without authentication", async () => {
    const logoutRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: { refreshToken: "whatever" },
    });
    expect(logoutRes.statusCode).toBe(401);

    const logoutAllRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
    });
    expect(logoutAllRes.statusCode).toBe(401);
  });

  it("refreshes, then logs out the current device's refresh token", async () => {
    const loginRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: ctx.adminEmail, password: ctx.adminPassword },
    });
    const { refreshToken } = loginRes.json().data;

    const refreshRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
    const rotated = refreshRes.json().data;
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toBeTruthy();

    const logoutRes = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: authHeader(ctx.adminToken),
      payload: { refreshToken: rotated.refreshToken },
    });
    expect(logoutRes.statusCode).toBe(204);
  });

  it("rejects refresh with an invalid token", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: "not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("logs out all devices for the current user", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      headers: authHeader(ctx.adminToken),
    });
    expect(res.statusCode).toBe(204);
  });
});
