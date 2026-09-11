import { Pool, RowDataPacket } from "mysql2/promise";
import { QuranRepository } from "../../domain/repositories/quranRepository";
import { QuranSurah } from "../../domain/entities/quranSurah";

interface QuranSurahRow extends RowDataPacket {
  surah_number: number;
  arabic_name: string;
  latin_name: string;
  verse_count: number;
}

function mapRow(row: QuranSurahRow): QuranSurah {
  return {
    surahNumber: row.surah_number,
    arabicName: row.arabic_name,
    latinName: row.latin_name,
    verseCount: row.verse_count,
  };
}

/**
 * The Quran reference dataset is fixed and small (114 rows), so it is cached
 * in memory after the first load to keep range validation synchronous.
 */
export class MysqlQuranRepository implements QuranRepository {
  private cache: Map<number, QuranSurah> | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureCache(): Promise<Map<number, QuranSurah>> {
    if (this.cache) return this.cache;

    const [rows] = await this.pool.query<QuranSurahRow[]>(
      "SELECT surah_number, arabic_name, latin_name, verse_count FROM quran_surahs ORDER BY surah_number ASC",
    );

    const cache = new Map<number, QuranSurah>();
    for (const row of rows) {
      const surah = mapRow(row);
      cache.set(surah.surahNumber, surah);
    }
    this.cache = cache;
    return cache;
  }

  async warmCache(): Promise<void> {
    await this.ensureCache();
  }

  getBySurahNumber(surahNumber: number): QuranSurah | undefined {
    if (!this.cache) {
      throw new Error("Quran cache has not been warmed. Call warmCache() during startup.");
    }
    return this.cache.get(surahNumber);
  }

  async getBySurahNumberAsync(surahNumber: number): Promise<QuranSurah | undefined> {
    const cache = await this.ensureCache();
    return cache.get(surahNumber);
  }

  async list(): Promise<QuranSurah[]> {
    const cache = await this.ensureCache();
    return Array.from(cache.values()).sort((a, b) => a.surahNumber - b.surahNumber);
  }
}
