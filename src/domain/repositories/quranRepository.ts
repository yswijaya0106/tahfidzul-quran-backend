import { QuranSurah } from "../entities/quranSurah";
import { SurahLookup } from "../value-objects/assessmentRange";

export interface QuranRepository extends SurahLookup {
  list(): Promise<QuranSurah[]>;
  getBySurahNumberAsync(surahNumber: number): Promise<QuranSurah | undefined>;
}
