import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { runMigrations } from "../../src/infrastructure/db/migrate";

describe("quran_surahs seed migration", () => {
  let pool: Pool;

  beforeAll(async () => {
    await runMigrations();
    pool = createPool();
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  it("seeds exactly 114 rows", async () => {
    const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS count FROM quran_surahs");
    expect(Number(rows[0].count)).toBe(114);
  });

  it("contains contiguous, unique surah numbers from 1 through 114", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT surah_number FROM quran_surahs ORDER BY surah_number ASC",
    );
    const numbers = rows.map((row: any) => row.surah_number);
    expect(new Set(numbers).size).toBe(114);
    numbers.forEach((n: number, index: number) => expect(n).toBe(index + 1));
  });

  it("matches the known boundary rows 1 and 114", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT surah_number, latin_name, verse_count FROM quran_surahs WHERE surah_number IN (1, 114) ORDER BY surah_number ASC",
    );
    expect(rows[0]).toMatchObject({ surah_number: 1, latin_name: "Al-Fatihah", verse_count: 7 });
    expect(rows[1]).toMatchObject({ surah_number: 114, latin_name: "An-Nas", verse_count: 6 });
  });
});
