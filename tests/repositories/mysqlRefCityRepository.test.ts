import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlRefProvinceRepository } from "../../src/infrastructure/repositories/mysqlRefProvinceRepository";
import { MysqlRefCityRepository } from "../../src/infrastructure/repositories/mysqlRefCityRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";

let pool: Pool;
let provinces: MysqlRefProvinceRepository;
let cities: MysqlRefCityRepository;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  provinces = new MysqlRefProvinceRepository(pool);
  cities = new MysqlRefCityRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("MysqlRefCityRepository", () => {
  it("lists at least the 420 seeded cities when unfiltered", async () => {
    const all = await cities.list();
    expect(all.length).toBeGreaterThanOrEqual(420);
  });

  it("filters cities by provinceId, all belonging to that province", async () => {
    const [province] = await provinces.list();
    const filtered = await cities.list(province!.id);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((c) => c.provinceId === province!.id)).toBe(true);
  });

  it("finds a city by id", async () => {
    const [first] = await cities.list();
    const found = await cities.findById(first!.id);
    expect(found).toMatchObject({ id: first!.id, cityName: first!.cityName });
  });

  it("returns null for a nonexistent city id", async () => {
    expect(await cities.findById(999_999)).toBeNull();
  });
});
