import { DailyTargetRepository } from "../../domain/repositories/dailyTargetRepository";
import { QuranRepository } from "../../domain/repositories/quranRepository";
import { AppError } from "../../domain/errors";
import { DailyTarget } from "../../domain/entities/dailyTarget";
import { validateAssessmentRange } from "../../domain/value-objects/assessmentRange";
import { AuthContext, assertAdmin } from "../authz/authContext";

const MIN_DAY = 1;
const MAX_DAY = 300;

export interface CreateDailyTargetInput {
  dayNumber: number;
  startSurahNumber: number;
  startVerseNumber: number;
  endSurahNumber: number;
  endVerseNumber: number;
}

export interface UpdateDailyTargetInput {
  startSurahNumber?: number;
  startVerseNumber?: number;
  endSurahNumber?: number;
  endVerseNumber?: number;
}

function validateDayNumber(dayNumber: number): void {
  if (!Number.isInteger(dayNumber) || dayNumber < MIN_DAY || dayNumber > MAX_DAY) {
    throw AppError.validation(`dayNumber must be an integer between ${MIN_DAY} and ${MAX_DAY}.`, {
      dayNumber: `Must be between ${MIN_DAY} and ${MAX_DAY}.`,
    });
  }
}

/**
 * CRUD for the "Target Tilawah/Tahfidz 300 Hari" reference schedule
 * (daily_targets): every role may read it (assessments/dashboards join
 * against it), but only admins may edit it — it's curriculum reference data,
 * same rule as Quran metadata.
 */
export class DailyTargetUseCases {
  constructor(
    private readonly dailyTargets: DailyTargetRepository,
    private readonly quran: QuranRepository,
  ) {}

  async list(): Promise<DailyTarget[]> {
    return this.dailyTargets.list();
  }

  async getByDayNumber(dayNumber: number): Promise<DailyTarget> {
    const found = await this.dailyTargets.findByDayNumber(dayNumber);
    if (!found) throw AppError.notFound("Daily target not found.");
    return found;
  }

  async create(auth: AuthContext, input: CreateDailyTargetInput): Promise<DailyTarget> {
    assertAdmin(auth);
    validateDayNumber(input.dayNumber);
    validateAssessmentRange(
      { surahNumber: input.startSurahNumber, verseNumber: input.startVerseNumber },
      { surahNumber: input.endSurahNumber, verseNumber: input.endVerseNumber },
      this.quran,
    );

    const existing = await this.dailyTargets.findByDayNumber(input.dayNumber);
    if (existing) {
      throw AppError.conflict(`A daily target for day ${input.dayNumber} already exists.`);
    }

    const target: DailyTarget = { ...input };
    await this.dailyTargets.create(target);
    return target;
  }

  async update(
    auth: AuthContext,
    dayNumber: number,
    input: UpdateDailyTargetInput,
  ): Promise<DailyTarget> {
    assertAdmin(auth);
    validateDayNumber(dayNumber);
    const existing = await this.dailyTargets.findByDayNumber(dayNumber);
    if (!existing) throw AppError.notFound("Daily target not found.");

    const next = {
      startSurahNumber: input.startSurahNumber ?? existing.startSurahNumber,
      startVerseNumber: input.startVerseNumber ?? existing.startVerseNumber,
      endSurahNumber: input.endSurahNumber ?? existing.endSurahNumber,
      endVerseNumber: input.endVerseNumber ?? existing.endVerseNumber,
    };
    validateAssessmentRange(
      { surahNumber: next.startSurahNumber, verseNumber: next.startVerseNumber },
      { surahNumber: next.endSurahNumber, verseNumber: next.endVerseNumber },
      this.quran,
    );

    await this.dailyTargets.update(dayNumber, next);
    return { dayNumber, ...next };
  }

  async delete(auth: AuthContext, dayNumber: number): Promise<void> {
    assertAdmin(auth);
    validateDayNumber(dayNumber);
    const existing = await this.dailyTargets.findByDayNumber(dayNumber);
    if (!existing) throw AppError.notFound("Daily target not found.");

    const hasAssessments = await this.dailyTargets.hasAssessments(dayNumber);
    if (hasAssessments) {
      throw AppError.conflict(
        "Cannot delete a daily target that assessments already reference.",
      );
    }

    await this.dailyTargets.delete(dayNumber);
  }
}
