import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlQuranRepository } from "../../src/infrastructure/repositories/mysqlQuranRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";

let pool: Pool;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
});

afterAll(async () => {
  await pool.end();
});

describe("MysqlQuranRepository", () => {
  it("lists all 114 surahs in order", async () => {
    const repo = new MysqlQuranRepository(pool);
    const surahs = await repo.list();
    expect(surahs).toHaveLength(114);
    expect(surahs[0]!.surahNumber).toBe(1);
    expect(surahs[113]!.surahNumber).toBe(114);
  });

  it("returns a surah asynchronously without warming the cache first", async () => {
    const repo = new MysqlQuranRepository(pool);
    const surah = await repo.getBySurahNumberAsync(1);
    expect(surah?.latinName).toBeTruthy();
    expect(await repo.getBySurahNumberAsync(9999)).toBeUndefined();
  });

  it("throws when getBySurahNumber is called before warming the cache", () => {
    const repo = new MysqlQuranRepository(pool);
    expect(() => repo.getBySurahNumber(1)).toThrow(/cache has not been warmed/);
  });

  it("returns a surah synchronously after warmCache()", async () => {
    const repo = new MysqlQuranRepository(pool);
    await repo.warmCache();
    expect(repo.getBySurahNumber(1)?.surahNumber).toBe(1);
    expect(repo.getBySurahNumber(9999)).toBeUndefined();
  });

  it("only queries the database once across repeated calls (cache reuse)", async () => {
    const repo = new MysqlQuranRepository(pool);
    const querySpy = pool.query.bind(pool);
    let calls = 0;
    (pool as unknown as { query: typeof pool.query }).query = ((...args: unknown[]) => {
      calls += 1;
      return (querySpy as (...a: unknown[]) => unknown)(...args);
    }) as typeof pool.query;

    await repo.list();
    await repo.list();
    await repo.getBySurahNumberAsync(1);

    (pool as unknown as { query: typeof pool.query }).query = querySpy;
    expect(calls).toBe(1);
  });
});
