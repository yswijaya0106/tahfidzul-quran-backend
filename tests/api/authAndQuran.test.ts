import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { FastifyInstance } from "fastify";
import { buildApp } from "../../src/presentation/http/app";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { BcryptPasswordHasher } from "../../src/infrastructure/auth/bcryptPasswordHasher";

describe("auth and quran API contract", () => {
  let app: FastifyInstance;
  let pool: Pool;
  const email = `admin-${uuid()}@example.com`;
  const password = "StrongPassw0rd!";

  beforeAll(async () => {
    await runMigrations();
    pool = createPool();

    const hasher = new BcryptPasswordHasher();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ADMIN', 1, ?, ?)`,
      [uuid(), "Test Admin", email, await hasher.hash(password), now, now],
    );

    app = await buildApp();
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("rejects unauthenticated access with 401", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/quran/surahs" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("returns a generic error for invalid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: email, password: "wrong-password" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).not.toMatch(/exist/i);
  });

  it("logs in and lists all 114 quran surahs in order", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: email, password },
    });
    expect(loginResponse.statusCode).toBe(200);
    const { accessToken } = loginResponse.json().data;

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/quran/surahs",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    const body = listResponse.json();
    expect(body.data).toHaveLength(114);
    expect(body.data[0]).toMatchObject({ surahNumber: 1, latinName: "Al-Fatihah" });
    expect(body.data[113]).toMatchObject({ surahNumber: 114, latinName: "An-Nas" });
  });

  it("rejects an out-of-range surah number with a documented error shape", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { identifier: email, password },
    });
    const { accessToken } = loginResponse.json().data;

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/quran/surahs/200",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: "NOT_FOUND" });
  });
});
