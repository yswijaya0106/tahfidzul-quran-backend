import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { runMigrations } from "../../src/infrastructure/db/migrate";

interface DailyTargetRow {
  day_number: number;
  start_surah_number: number;
  start_verse_number: number;
  end_surah_number: number;
  end_verse_number: number;
}

// The full 300-day schedule, seeded and cross-validated end to end.
const SEEDED_RANGES: [number, number][] = [[1, 300]];
const SEEDED_DAY_COUNT = SEEDED_RANGES.reduce((sum, [from, to]) => sum + (to - from + 1), 0);

describe("daily_targets seed (complete, days 1-300)", () => {
  let pool: Pool;

  beforeAll(async () => {
    await runMigrations();
    pool = createPool();
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  it("seeds exactly the currently-verified days", async () => {
    const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS count FROM daily_targets");
    expect(Number(rows[0].count)).toBe(SEEDED_DAY_COUNT);
  });

  // These days each print a 1-verse gap after the previous day, in the source
  // photo itself - kept as printed rather than silently "corrected".
  const KNOWN_SOURCE_GAPS = new Set([87, 138]);

  it("chains each day's start to the previous day's end within each verified range", async () => {
    const [rows] = await pool.query<any[]>("SELECT * FROM daily_targets ORDER BY day_number ASC");
    const byDay = new Map((rows as DailyTargetRow[]).map((row) => [row.day_number, row]));

    for (const [from, to] of SEEDED_RANGES) {
      for (let dayNumber = from + 1; dayNumber <= to; dayNumber += 1) {
        if (KNOWN_SOURCE_GAPS.has(dayNumber)) continue;
        const prev = byDay.get(dayNumber - 1)!;
        const cur = byDay.get(dayNumber)!;
        expect(cur).toBeDefined();
        if (cur.start_surah_number === prev.end_surah_number) {
          expect(cur.start_verse_number).toBe(prev.end_verse_number + 1);
        } else {
          // Crossed into a new surah: must be the very next surah, starting at verse 1.
          expect(cur.start_surah_number).toBe(prev.end_surah_number + 1);
          expect(cur.start_verse_number).toBe(1);
        }
      }
    }
  });

  it("starts at Al-Fatihah 1 and day 24 ends exactly at Al-Baqarah's last verse (286)", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (1, 24) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ start_surah_number: 1, start_verse_number: 1 });
    expect(rows[1]).toMatchObject({ end_surah_number: 2, end_verse_number: 286 });
  });

  it("day 25 starts Ali 'Imran at verse 1 and day 32 ends at verse 132", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (25, 32) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ start_surah_number: 3, start_verse_number: 1 });
    expect(rows[1]).toMatchObject({ end_surah_number: 3, end_verse_number: 132 });
  });

  it("day 37 ends exactly at Ali 'Imran's last verse (200) and day 63 crosses into Al-An'am", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (37, 63) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 3, end_verse_number: 200 });
    expect(rows[1]).toMatchObject({
      start_surah_number: 5,
      start_verse_number: 114,
      end_surah_number: 6,
      end_verse_number: 8,
    });
  });

  it("day 74 ends exactly at Al-An'am's last verse (165) and day 78 connects to the already-seeded day 79", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (74, 78, 79) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 6, end_verse_number: 165 });
    expect(rows[1]).toMatchObject({ end_surah_number: 7, end_verse_number: 67 });
    expect(rows[2]).toMatchObject({ start_surah_number: 7, start_verse_number: 68 });
  });

  it("days 87, 92, and 123 end exactly at their surah's last verse", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (87, 92, 123) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 7, end_verse_number: 206 });
    expect(rows[1]).toMatchObject({ end_surah_number: 8, end_verse_number: 75 });
    expect(rows[2]).toMatchObject({ end_surah_number: 12, end_verse_number: 111 });
  });

  it("day 124 starts Ar-Ra'd at verse 1", async () => {
    const [rows] = await pool.query<any[]>("SELECT * FROM daily_targets WHERE day_number = 124");
    expect(rows[0]).toMatchObject({ start_surah_number: 13, start_verse_number: 1 });
  });

  it("day 151 ends exactly at Al-Kahf's last verse (110) and day 168 ends Al-Hajj at verse 55", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (151, 168) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 18, end_verse_number: 110 });
    expect(rows[1]).toMatchObject({ end_surah_number: 22, end_verse_number: 55 });
  });

  it("days 182, 187, 204, and 206 end exactly at their surah's last verse", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (182, 187, 204, 206) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 25, end_verse_number: 77 });
    expect(rows[1]).toMatchObject({ end_surah_number: 26, end_verse_number: 227 });
    expect(rows[2]).toMatchObject({ end_surah_number: 30, end_verse_number: 60 });
    expect(rows[3]).toMatchObject({ end_surah_number: 31, end_verse_number: 34 });
  });

  it("days 225, 237, 240, 248, 252, and 254 end exactly at their surah's last verse", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (225, 237, 240, 248, 252, 254) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 37, end_verse_number: 182 });
    expect(rows[1]).toMatchObject({ end_surah_number: 40, end_verse_number: 85 });
    expect(rows[2]).toMatchObject({ end_surah_number: 41, end_verse_number: 54 });
    expect(rows[3]).toMatchObject({ end_surah_number: 44, end_verse_number: 59 });
    expect(rows[4]).toMatchObject({ end_surah_number: 46, end_verse_number: 35 });
    expect(rows[5]).toMatchObject({ end_surah_number: 47, end_verse_number: 38 });
  });

  it("days 273, 275, 293, and 299 end exactly at their surah's last verse", async () => {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM daily_targets WHERE day_number IN (273, 275, 293, 299) ORDER BY day_number ASC",
    );
    expect(rows[0]).toMatchObject({ end_surah_number: 59, end_verse_number: 24 });
    expect(rows[1]).toMatchObject({ end_surah_number: 61, end_verse_number: 14 });
    expect(rows[2]).toMatchObject({ end_surah_number: 84, end_verse_number: 25 });
    expect(rows[3]).toMatchObject({ end_surah_number: 102, end_verse_number: 8 });
  });

  it("day 300 ends the entire schedule at the Quran's final verse, An-Nas 6", async () => {
    const [rows] = await pool.query<any[]>("SELECT * FROM daily_targets WHERE day_number = 300");
    expect(rows[0]).toMatchObject({
      start_surah_number: 103,
      start_verse_number: 1,
      end_surah_number: 114,
      end_verse_number: 6,
    });
  });
});
