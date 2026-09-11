import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlLocationRepository } from "../../src/infrastructure/repositories/mysqlLocationRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { Location } from "../../src/domain/entities/location";

let pool: Pool;
let repo: MysqlLocationRepository;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlLocationRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeLocation(overrides: Partial<Location> = {}): Location {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    name: `Location ${uuid()}`,
    address: "Street 1",
    latitude: -6.2,
    longitude: 106.8,
    phone: null,
    description: null,
    coverPhotoObjectKey: null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlLocationRepository", () => {
  it("creates a location with organization members and finds it by id", async () => {
    const location = makeLocation();
    await repo.create(location, [
      { id: uuid(), locationId: location.id, name: "Member A", roleTitle: "Ustadz", phone: null },
    ]);

    const found = await repo.findById(location.id);
    expect(found?.name).toBe(location.name);
    expect(found?.organizationMembers).toHaveLength(1);
    expect(found?.organizationMembers[0]!.name).toBe("Member A");
  });

  it("returns null for a missing id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("finds an active location by name only", async () => {
    const location = makeLocation();
    await repo.create(location, []);

    expect((await repo.findActiveByName(location.name))?.id).toBe(location.id);

    await repo.update(location.id, { status: "INACTIVE" });
    expect(await repo.findActiveByName(location.name)).toBeNull();
  });

  it("lists locations filtered by status, search, and ids", async () => {
    const marker = uuid().slice(0, 8);
    const location = makeLocation({ name: `Findable ${marker}` });
    await repo.create(location, []);

    const byStatus = await repo.list({ status: "ACTIVE" }, { page: 1, pageSize: 50 });
    expect(byStatus.data.some((l) => l.id === location.id)).toBe(true);

    const bySearch = await repo.list({ search: marker }, { page: 1, pageSize: 50 });
    expect(bySearch.data.map((l) => l.id)).toEqual([location.id]);

    const byIds = await repo.list({ ids: [location.id] }, { page: 1, pageSize: 50 });
    expect(byIds.data.map((l) => l.id)).toEqual([location.id]);

    const byEmptyIds = await repo.list({ ids: [] }, { page: 1, pageSize: 50 });
    expect(byEmptyIds).toEqual({ data: [], meta: { page: 1, pageSize: 50, total: 0 } });
  });

  it("updates location fields including clearing deletedAt", async () => {
    const location = makeLocation();
    await repo.create(location, []);

    await repo.update(location.id, {
      name: "Renamed",
      address: "New street",
      latitude: 1,
      longitude: 2,
      phone: "0800",
      description: "desc",
      coverPhotoObjectKey: "key",
      deletedAt: new Date().toISOString(),
    });
    let found = await repo.findById(location.id);
    expect(found?.name).toBe("Renamed");
    expect(found?.deletedAt).not.toBeNull();

    await repo.update(location.id, { deletedAt: null });
    found = await repo.findById(location.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("does nothing when the update patch is empty", async () => {
    const location = makeLocation();
    await repo.create(location, []);
    await expect(repo.update(location.id, {})).resolves.toBeUndefined();
  });

  it("replaces organization members", async () => {
    const location = makeLocation();
    await repo.create(location, [
      { id: uuid(), locationId: location.id, name: "Old", roleTitle: "Role", phone: null },
    ]);

    await repo.replaceMembers(location.id, [
      { id: uuid(), locationId: location.id, name: "New", roleTitle: "Role", phone: "0800" },
    ]);

    const found = await repo.findById(location.id);
    expect(found?.organizationMembers).toHaveLength(1);
    expect(found?.organizationMembers[0]!.name).toBe("New");
  });

  it("soft-deletes a location", async () => {
    const location = makeLocation();
    await repo.create(location, []);
    await repo.softDelete(location.id);

    const found = await repo.findById(location.id);
    expect(found?.deletedAt).not.toBeNull();
  });
});
