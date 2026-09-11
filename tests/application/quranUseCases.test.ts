import { describe, expect, it } from "vitest";
import { QuranUseCases } from "../../src/application/quran/quranUseCases";
import { QuranSurah } from "../../src/domain/entities/quranSurah";

class FakeQuranRepository {
  surahs: QuranSurah[] = [
    { surahNumber: 1, arabicName: "الفاتحة", latinName: "Al-Fatihah", verseCount: 7 },
  ];
  getBySurahNumber(n: number) {
    return this.surahs.find((s) => s.surahNumber === n);
  }
  async getBySurahNumberAsync(n: number) {
    return this.surahs.find((s) => s.surahNumber === n) ?? null;
  }
  async list() {
    return this.surahs;
  }
}

describe("QuranUseCases", () => {
  it("lists all surahs", async () => {
    const useCase = new QuranUseCases(new FakeQuranRepository() as never);
    const result = await useCase.list();
    expect(result).toHaveLength(1);
  });

  it("returns a surah by number", async () => {
    const useCase = new QuranUseCases(new FakeQuranRepository() as never);
    const result = await useCase.getBySurahNumber(1);
    expect(result.latinName).toBe("Al-Fatihah");
  });

  it("throws not found for an unknown surah number", async () => {
    const useCase = new QuranUseCases(new FakeQuranRepository() as never);
    await expect(useCase.getBySurahNumber(999)).rejects.toMatchObject({ status: 404 });
  });
});
