import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlAngkatanRepository } from "../../src/infrastructure/repositories/mysqlAngkatanRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { Angkatan } from "../../src/domain/entities/angkatan";

let pool: Pool;
let repo: MysqlAngkatanRepository;
let locationId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlAngkatanRepository(pool);
  locationId = await createLocation(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeAngkatan(overrides: Partial<Angkatan> = {}): Angkatan {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    locationId,
    name: `Angkatan ${uuid().slice(0, 8)}`,
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlAngkatanRepository", () => {
  it("creates and finds an angkatan by id", async () => {
    const angkatan = makeAngkatan({ name: "Angkatan Find Test" });
    await repo.create(angkatan);

    const found = await repo.findById(angkatan.id);
    expect(found).toMatchObject({
      id: angkatan.id,
      locationId,
      name: "Angkatan Find Test",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
  });

  it("returns null for a nonexistent id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("finds an active angkatan by location and name, ignoring other locations", async () => {
    const otherLocationId = await createLocation(pool);
    const angkatan = makeAngkatan({ name: "Scoped Name" });
    await repo.create(angkatan);

    expect(await repo.findActiveByName(locationId, "Scoped Name")).toMatchObject({
      id: angkatan.id,
    });
    expect(await repo.findActiveByName(otherLocationId, "Scoped Name")).toBeNull();
  });

  it("lists angkatan filtered by locationId and search", async () => {
    const otherLocationId = await createLocation(pool);
    const a1 = makeAngkatan({ name: "List Test Alpha" });
    const a2 = makeAngkatan({ name: "List Test Beta", locationId: otherLocationId });
    await repo.create(a1);
    await repo.create(a2);

    const scoped = await repo.list({ locationId }, { page: 1, pageSize: 50 });
    expect(scoped.data.some((a) => a.id === a1.id)).toBe(true);
    expect(scoped.data.some((a) => a.id === a2.id)).toBe(false);

    const searched = await repo.list({ search: "List Test Alpha" }, { page: 1, pageSize: 50 });
    expect(searched.data.some((a) => a.id === a1.id)).toBe(true);
    expect(searched.data.some((a) => a.id === a2.id)).toBe(false);

    expect(await repo.list({ locationIds: [] }, { page: 1, pageSize: 50 })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
  });

  it("updates fields and soft-deletes", async () => {
    const angkatan = makeAngkatan({ name: "Update Test" });
    await repo.create(angkatan);

    await repo.update(angkatan.id, { name: "Updated Name", endDate: "2025-06-30" });
    const updated = await repo.findById(angkatan.id);
    expect(updated).toMatchObject({ name: "Updated Name", endDate: "2025-06-30" });

    await repo.softDelete(angkatan.id);
    const deleted = await repo.findById(angkatan.id);
    expect(deleted?.deletedAt).not.toBeNull();
    expect(await repo.findActiveByName(locationId, "Updated Name")).toBeNull();
  });

  it("reports whether an angkatan has students assigned", async () => {
    const angkatan = makeAngkatan({ name: "Has Students Test" });
    await repo.create(angkatan);
    expect(await repo.hasStudents(angkatan.id)).toBe(false);

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await pool.query(
      `INSERT INTO students (id, student_code, full_name, location_id, angkatan_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [uuid(), `TQ-${uuid().slice(0, 8)}`, "Student", locationId, angkatan.id, now, now],
    );
    expect(await repo.hasStudents(angkatan.id)).toBe(true);
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
