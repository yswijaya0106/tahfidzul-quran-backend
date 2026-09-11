import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlUserRepository } from "../../src/infrastructure/repositories/mysqlUserRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { User } from "../../src/domain/entities/user";

let pool: Pool;
let repo: MysqlUserRepository;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlUserRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    fullName: "Repo Test User",
    email: `user-${uuid()}@example.com`,
    phone: null,
    passwordHash: "hash",
    role: "LOCATION_OPERATOR",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlUserRepository", () => {
  it("creates and finds a user by id", async () => {
    const user = makeUser();
    await repo.create(user);

    const found = await repo.findById(user.id);
    expect(found?.email).toBe(user.email);
    expect(found?.createdAt).toBeTruthy();
  });

  it("returns null for a missing id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("finds a user by email or phone", async () => {
    const user = makeUser({ phone: `08${Date.now()}` });
    await repo.create(user);

    expect((await repo.findByEmailOrPhone(user.email!))?.id).toBe(user.id);
    expect((await repo.findByEmailOrPhone(user.phone!))?.id).toBe(user.id);
    expect(await repo.findByEmailOrPhone("nonexistent@example.com")).toBeNull();
  });

  it("does not find a soft-deleted user by email/phone", async () => {
    const user = makeUser();
    await repo.create(user);
    await repo.update(user.id, { deletedAt: new Date().toISOString() });

    expect(await repo.findByEmailOrPhone(user.email!)).toBeNull();
  });

  it("lists users filtered by role, active status, and search", async () => {
    const marker = uuid().slice(0, 8);
    const admin = makeUser({ role: "ADMIN", fullName: `Findable ${marker}`, isActive: true });
    const operator = makeUser({ role: "LOCATION_OPERATOR", isActive: false });
    await repo.create(admin);
    await repo.create(operator);

    const byRole = await repo.list({ role: "ADMIN" }, { page: 1, pageSize: 50 });
    expect(byRole.data.some((u) => u.id === admin.id)).toBe(true);
    expect(byRole.data.some((u) => u.id === operator.id)).toBe(false);

    const byActive = await repo.list({ isActive: false }, { page: 1, pageSize: 50 });
    expect(byActive.data.some((u) => u.id === operator.id)).toBe(true);

    const byActiveTrue = await repo.list({ isActive: true }, { page: 1, pageSize: 50 });
    expect(byActiveTrue.data.some((u) => u.id === admin.id)).toBe(true);
    expect(byActiveTrue.data.some((u) => u.id === operator.id)).toBe(false);

    const bySearch = await repo.list({ search: marker }, { page: 1, pageSize: 50 });
    expect(bySearch.data.map((u) => u.id)).toEqual([admin.id]);
  });

  it("paginates list results", async () => {
    const result = await repo.list({}, { page: 1, pageSize: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.pageSize).toBe(1);
  });

  it("updates a user's fields", async () => {
    const user = makeUser();
    await repo.create(user);

    await repo.update(user.id, { fullName: "Updated Name", isActive: false });
    const updated = await repo.findById(user.id);
    expect(updated?.fullName).toBe("Updated Name");
    expect(updated?.isActive).toBe(false);
  });

  it("does nothing when the update patch is empty", async () => {
    const user = makeUser();
    await repo.create(user);
    await expect(repo.update(user.id, {})).resolves.toBeUndefined();
  });

  it("clears deletedAt back to null", async () => {
    const user = makeUser();
    await repo.create(user);
    await repo.update(user.id, { deletedAt: new Date().toISOString() });
    await repo.update(user.id, { deletedAt: null });
    const found = await repo.findById(user.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("assigns and lists locations for a user, replacing prior assignments", async () => {
    const user = makeUser();
    await repo.create(user);

    const locationId = await createLocation(pool);
    await repo.assignLocations(user.id, [locationId]);

    expect(await repo.getAssignedLocationIds(user.id)).toEqual([locationId]);
    const assignments = await repo.listAssignments(user.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.locationId).toBe(locationId);

    await repo.assignLocations(user.id, []);
    expect(await repo.getAssignedLocationIds(user.id)).toEqual([]);
  });
});

async function createLocation(pool: Pool): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO locations (id, name, address, status, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, `Location ${id.slice(0, 8)}`, "Street", now, now],
  );
  return id;
}
