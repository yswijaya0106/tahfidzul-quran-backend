import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlRefProvinceRepository } from "../../src/infrastructure/repositories/mysqlRefProvinceRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";

let pool: Pool;
let repo: MysqlRefProvinceRepository;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlRefProvinceRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("MysqlRefProvinceRepository", () => {
  it("lists at least the 33 seeded provinces, sorted by name", async () => {
    const provinces = await repo.list();
    expect(provinces.length).toBeGreaterThanOrEqual(33);
    const names = provinces.map((p) => p.provinceName ?? "");
    expect(names).toEqual([...names].sort());
  });

  it("finds a province by id", async () => {
    const [first] = await repo.list();
    const found = await repo.findById(first!.id);
    expect(found).toMatchObject({ id: first!.id, provinceName: first!.provinceName });
  });

  it("returns null for a nonexistent province id", async () => {
    expect(await repo.findById(999_999)).toBeNull();
  });
});
