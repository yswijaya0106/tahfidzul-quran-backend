import { describe, expect, it } from "vitest";
import { DailyTargetUseCases } from "../../src/application/dailyTargets/dailyTargetUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { DailyTarget } from "../../src/domain/entities/dailyTarget";
import { QuranSurah } from "../../src/domain/entities/quranSurah";

class FakeDailyTargetRepository {
  targets: DailyTarget[] = [
    { dayNumber: 1, startSurahNumber: 1, startVerseNumber: 1, endSurahNumber: 2, endVerseNumber: 16 },
  ];
  assessmentDayNumbers = new Set<number>();

  async list() {
    return [...this.targets].sort((a, b) => a.dayNumber - b.dayNumber);
  }
  async findByDayNumber(dayNumber: number) {
    return this.targets.find((t) => t.dayNumber === dayNumber) ?? null;
  }
  async create(target: DailyTarget) {
    this.targets.push(target);
  }
  async update(dayNumber: number, patch: Partial<Omit<DailyTarget, "dayNumber">>) {
    const index = this.targets.findIndex((t) => t.dayNumber === dayNumber);
    this.targets[index] = { ...this.targets[index]!, ...patch };
  }
  async delete(dayNumber: number) {
    this.targets = this.targets.filter((t) => t.dayNumber !== dayNumber);
  }
  async hasAssessments(dayNumber: number) {
    return this.assessmentDayNumbers.has(dayNumber);
  }
}

class FakeQuranRepository {
  surahs: QuranSurah[] = [
    { surahNumber: 1, arabicName: "الفاتحة", latinName: "Al-Fatihah", verseCount: 7 },
    { surahNumber: 2, arabicName: "البقرة", latinName: "Al-Baqarah", verseCount: 286 },
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

function buildUseCase() {
  const dailyTargets = new FakeDailyTargetRepository();
  const quran = new FakeQuranRepository();
  const useCase = new DailyTargetUseCases(dailyTargets as never, quran as never);
  return { useCase, dailyTargets };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

describe("DailyTargetUseCases", () => {
  it("lists targets ordered by day number", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.list();
    expect(result).toEqual([
      expect.objectContaining({ dayNumber: 1 }),
    ]);
  });

  it("returns a target by day number", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getByDayNumber(1);
    expect(result.endSurahNumber).toBe(2);
  });

  it("throws not found for an unknown day number", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.getByDayNumber(2)).rejects.toMatchObject({ status: 404 });
  });

  it("creates a new daily target as admin", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.create(admin, {
      dayNumber: 2,
      startSurahNumber: 2,
      startVerseNumber: 17,
      endSurahNumber: 2,
      endVerseNumber: 29,
    });
    expect(result.dayNumber).toBe(2);
  });

  it("rejects create for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(operator, {
        dayNumber: 2,
        startSurahNumber: 2,
        startVerseNumber: 17,
        endSurahNumber: 2,
        endVerseNumber: 29,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects create with a dayNumber that already exists", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        dayNumber: 1,
        startSurahNumber: 1,
        startVerseNumber: 1,
        endSurahNumber: 1,
        endVerseNumber: 5,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects create with an invalid Quran range", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        dayNumber: 2,
        startSurahNumber: 1,
        startVerseNumber: 1,
        endSurahNumber: 1,
        endVerseNumber: 999,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("updates an existing target as admin", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.update(admin, 1, { endVerseNumber: 20 });
    expect(result.endVerseNumber).toBe(20);
  });

  it("rejects update for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.update(operator, 1, { endVerseNumber: 20 })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws not found updating an unknown day number", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.update(admin, 250, { endVerseNumber: 20 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deletes a target with no referencing assessments", async () => {
    const { useCase, dailyTargets } = buildUseCase();
    await useCase.delete(admin, 1);
    expect(await dailyTargets.findByDayNumber(1)).toBeNull();
  });

  it("rejects deleting a target that assessments still reference", async () => {
    const { useCase, dailyTargets } = buildUseCase();
    dailyTargets.assessmentDayNumbers.add(1);
    await expect(useCase.delete(admin, 1)).rejects.toMatchObject({ status: 409 });
  });

  it("rejects delete for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.delete(operator, 1)).rejects.toMatchObject({ status: 403 });
  });
});
