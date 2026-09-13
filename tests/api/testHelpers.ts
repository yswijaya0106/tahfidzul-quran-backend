import { v4 as uuid } from "uuid";
import { FastifyInstance } from "fastify";
import { buildApp } from "../../src/presentation/http/app";
import { buildContainer, Container } from "../../src/infrastructure/container";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { BcryptPasswordHasher } from "../../src/infrastructure/auth/bcryptPasswordHasher";
import { Pool } from "../../src/infrastructure/db/pool";

export interface TestContext {
  app: FastifyInstance;
  container: Container;
  pool: Pool;
  adminToken: string;
  adminId: string;
  adminEmail: string;
  adminPassword: string;
}

export async function setupTestApp(containerOverrides?: Partial<Container>): Promise<TestContext> {
  await runMigrations();
  const container = await buildContainer();
  Object.assign(container, containerOverrides);
  const app = await buildApp(container);
  await app.ready();

  const adminEmail = `admin-${uuid()}@example.com`;
  const adminPassword = "StrongPassw0rd!";
  const hasher = new BcryptPasswordHasher();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const adminId = uuid();
  await container.pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ADMIN', 1, ?, ?)`,
    [adminId, "Test Admin", adminEmail, await hasher.hash(adminPassword), now, now],
  );

  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { identifier: adminEmail, password: adminPassword },
  });
  const adminToken = loginResponse.json().data.accessToken as string;

  return { app, container, pool: container.pool, adminToken, adminId, adminEmail, adminPassword };
}

export async function createOperator(
  ctx: TestContext,
  locationIds: string[] = [],
): Promise<{ id: string; token: string }> {
  const email = `operator-${uuid()}@example.com`;
  const password = "StrongPassw0rd!";
  const hasher = new BcryptPasswordHasher();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const id = uuid();
  await ctx.pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'LOCATION_OPERATOR', 1, ?, ?)`,
    [id, "Test Operator", email, await hasher.hash(password), now, now],
  );
  for (const locationId of locationIds) {
    await ctx.pool.query(
      `INSERT INTO user_location_assignments (id, user_id, location_id, created_at) VALUES (?, ?, ?, NOW())`,
      [uuid(), id, locationId],
    );
  }

  // Mint the access token directly via the token service rather than
  // POSTing to /auth/login: that route is capped at 10 req/min (brute-force
  // protection), and test files that create several operators to check
  // location-scoped authorization quickly exceed it, making createOperator
  // itself flaky. assignedLocationIds is looked up from the DB per-request
  // by the `authenticate` plugin (not carried in the token), so a token
  // minted this way is authorization-equivalent to a real login.
  const token = ctx.container.tokenService.signAccessToken({
    sub: id,
    role: "LOCATION_OPERATOR",
  });
  return { id, token };
}

export async function createLocationRow(pool: Pool, overrides: Record<string, unknown> = {}) {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO locations (id, name, address, kab_kota, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      overrides.name ?? `Location ${id.slice(0, 8)}`,
      overrides.address ?? "Street",
      overrides.kabKota ?? null,
      overrides.status ?? "ACTIVE",
      now,
      now,
    ],
  );
  return id;
}

export async function createStudentRow(pool: Pool, locationId: string, name = "Test Student") {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO students (id, student_code, full_name, location_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, `TQ-${id.slice(0, 8)}`, name, locationId, now, now],
  );
  return id;
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
