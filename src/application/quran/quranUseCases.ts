import { QuranRepository } from "../../domain/repositories/quranRepository";
import { QuranSurah } from "../../domain/entities/quranSurah";
import { AppError } from "../../domain/errors";

export class QuranUseCases {
  constructor(private readonly quran: QuranRepository) {}

  async list(): Promise<QuranSurah[]> {
    return this.quran.list();
  }

  async getBySurahNumber(surahNumber: number): Promise<QuranSurah> {
    const surah = await this.quran.getBySurahNumberAsync(surahNumber);
    if (!surah) throw AppError.notFound("Surah not found.");
    return surah;
  }
}
