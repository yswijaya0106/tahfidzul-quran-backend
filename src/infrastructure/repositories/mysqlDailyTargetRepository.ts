import { Pool, RowDataPacket } from "mysql2/promise";
import { DailyTargetRepository } from "../../domain/repositories/dailyTargetRepository";
import { DailyTarget } from "../../domain/entities/dailyTarget";

interface DailyTargetRow extends RowDataPacket {
  day_number: number;
  start_surah_number: number;
  start_verse_number: number;
  end_surah_number: number;
  end_verse_number: number;
}

function mapDailyTarget(row: DailyTargetRow): DailyTarget {
  return {
    dayNumber: row.day_number,
    startSurahNumber: row.start_surah_number,
    startVerseNumber: row.start_verse_number,
    endSurahNumber: row.end_surah_number,
    endVerseNumber: row.end_verse_number,
  };
}

export class MysqlDailyTargetRepository implements DailyTargetRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<DailyTarget[]> {
    const [rows] = await this.pool.query<DailyTargetRow[]>(
      "SELECT * FROM daily_targets ORDER BY day_number ASC",
    );
    return rows.map(mapDailyTarget);
  }

  async findByDayNumber(dayNumber: number): Promise<DailyTarget | null> {
    const [rows] = await this.pool.query<DailyTargetRow[]>(
      "SELECT * FROM daily_targets WHERE day_number = ?",
      [dayNumber],
    );
    return rows[0] ? mapDailyTarget(rows[0]) : null;
  }

  async create(target: DailyTarget): Promise<void> {
    await this.pool.query(
      `INSERT INTO daily_targets
        (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
       VALUES (?, ?, ?, ?, ?)`,
      [
        target.dayNumber,
        target.startSurahNumber,
        target.startVerseNumber,
        target.endSurahNumber,
        target.endVerseNumber,
      ],
    );
  }

  async update(
    dayNumber: number,
    patch: Partial<Omit<DailyTarget, "dayNumber">>,
  ): Promise<void> {
    const columnMap: Record<string, unknown> = {
      start_surah_number: patch.startSurahNumber,
      start_verse_number: patch.startVerseNumber,
      end_surah_number: patch.endSurahNumber,
      end_verse_number: patch.endVerseNumber,
    };

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (fields.length === 0) return;
    params.push(dayNumber);
    await this.pool.query(
      `UPDATE daily_targets SET ${fields.join(", ")} WHERE day_number = ?`,
      params,
    );
  }

  async delete(dayNumber: number): Promise<void> {
    await this.pool.query("DELETE FROM daily_targets WHERE day_number = ?", [dayNumber]);
  }

  async hasAssessments(dayNumber: number): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM memorization_assessments WHERE day_number = ? LIMIT 1",
      [dayNumber],
    );
    return rows.length > 0;
  }
}
