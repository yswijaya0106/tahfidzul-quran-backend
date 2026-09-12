import { DailyTarget } from "../entities/dailyTarget";

export interface DailyTargetRepository {
  list(): Promise<DailyTarget[]>;
  findByDayNumber(dayNumber: number): Promise<DailyTarget | null>;
  create(target: DailyTarget): Promise<void>;
  update(dayNumber: number, patch: Partial<Omit<DailyTarget, "dayNumber">>): Promise<void>;
  delete(dayNumber: number): Promise<void>;
  /** Whether any assessment currently references this program day. */
  hasAssessments(dayNumber: number): Promise<boolean>;
}
