import { DashboardRepository, DateRange } from "../../domain/repositories/dashboardRepository";
import { StudentRepository } from "../../domain/repositories/studentRepository";
import { DailyTargetRepository } from "../../domain/repositories/dailyTargetRepository";
import { QuranRepository } from "../../domain/repositories/quranRepository";
import { AppError } from "../../domain/errors";
import {
  computeDayNumber,
  computeTargetStatus,
  TargetStatus,
} from "../../domain/entities/dailyTarget";
import { cumulativeVerseIndex } from "../../domain/value-objects/assessmentRange";
import { AuthContext, assertAdmin, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";
import { ObjectStorage } from "../files/ports";

export interface DashboardEnvelope<T> {
  range: DateRange;
  timezone: string;
  lastUpdatedAt: string;
  data: T;
}

const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 14;

export type { TargetStatus };

export interface TodayActivityPhotoItem {
  photoId: string;
  photoUrl: string;
  caption: string | null;
  uploadedAt: string;
  activityId: string;
  activityTitle: string;
  locationId: string;
  locationName: string;
  kabKota: string | null;
}

export interface StudentMemorizationProgressItem {
  studentId: string;
  fullName: string;
  studentCode: string;
  locationId: string;
  locationName: string;
  kabKota: string | null;
  assessmentDate: string;
  achievedEndSurahNumber: number;
  achievedEndVerseNumber: number;
  dayNumber: number | null;
  targetEndSurahNumber: number | null;
  targetEndVerseNumber: number | null;
  targetStatus: TargetStatus;
}

export type LeaderboardScope = "AGGREGATE" | "DAILY";

/** One ranked row of the school-wide achievement-vs-target leaderboard.
 * `deltaVerses` is the signed linear-verse difference between the student's
 * achieved position and their daily target's position — positive means
 * ahead of target, negative means behind. Rows are sorted by `deltaVerses`
 * descending (furthest ahead first). Students with no program start date,
 * no memorization assessment yet, or no daily-target data for their current
 * day are excluded (there is nothing to rank them against). */
export interface LeaderboardItem {
  rank: number;
  studentId: string;
  fullName: string;
  studentCode: string;
  locationId: string;
  locationName: string;
  kabKota: string | null;
  dayNumber: number;
  assessmentDate: string | null;
  achievedEndSurahNumber: number;
  achievedEndVerseNumber: number;
  targetEndSurahNumber: number;
  targetEndVerseNumber: number;
  deltaVerses: number;
  targetStatus: TargetStatus;
}

export class DashboardUseCases {
  constructor(
    private readonly dashboards: DashboardRepository,
    private readonly students: StudentRepository,
    private readonly clock: Clock,
    private readonly objectStorage: ObjectStorage,
    private readonly dailyTargets: DailyTargetRepository,
    private readonly quran: QuranRepository,
  ) {}

  async getLocationDashboard(
    auth: AuthContext,
    locationId: string,
    range: DateRange,
    timezone: string,
    inactivityThresholdDays: number = DEFAULT_INACTIVITY_THRESHOLD_DAYS,
  ) {
    assertLocationScope(auth, locationId);
    const data = await this.dashboards.getLocationDashboard(
      locationId,
      range,
      inactivityThresholdDays,
    );
    const recentActivities = await Promise.all(
      data.recentActivities.map(async ({ thumbnailObjectKey, ...activity }) => ({
        ...activity,
        thumbnailUrl: thumbnailObjectKey
          ? await this.objectStorage.createSignedDownloadUrl(thumbnailObjectKey)
          : null,
      })),
    );
    return {
      range,
      timezone,
      lastUpdatedAt: this.clock.nowIso(),
      data: { ...data, recentActivities },
    };
  }

  async getStudentDashboard(
    auth: AuthContext,
    studentId: string,
    range: DateRange,
    timezone: string,
  ) {
    const student = await this.students.findById(studentId);
    if (!student || student.deletedAt) throw AppError.notFound("Student not found.");
    assertLocationScope(auth, student.locationId);

    const data = await this.dashboards.getStudentDashboard(studentId, range);
    return {
      range,
      timezone,
      lastUpdatedAt: this.clock.nowIso(),
      data,
    };
  }

  /** Admin-only cross-location progress overview (activities/assessments submitted for a given day). */
  async getLocationsOverview(auth: AuthContext, date: string) {
    assertAdmin(auth);
    const data = await this.dashboards.getLocationsOverview(date);
    return {
      date,
      lastUpdatedAt: this.clock.nowIso(),
      data,
    };
  }

  /** Admin-only list of students who submitted new memorization today, with target status. */
  async getTodayMemorizationProgress(auth: AuthContext, date: string) {
    assertAdmin(auth);
    const rows = await this.dashboards.getTodayMemorizationProgress(date);
    const data: StudentMemorizationProgressItem[] = rows.map((row) => ({
      ...row,
      targetStatus: computeTargetStatus(
        row.achievedEndSurahNumber,
        row.achievedEndVerseNumber,
        row.targetEndSurahNumber,
        row.targetEndVerseNumber,
      ),
    }));
    return {
      date,
      lastUpdatedAt: this.clock.nowIso(),
      data,
    };
  }

  /**
   * Leaderboard ranking students by how far their achieved position exceeds
   * (or trails) their daily target, in linear verse count. `scope: "DAILY"`
   * only considers students who submitted a new-memorization assessment on
   * `date`; `scope: "AGGREGATE"` considers every active student's
   * furthest-ever position against the target for their *current* program
   * day (today, relative to their program_start_date), regardless of when
   * that position was recorded.
   *
   * With `locationId`, this is a single rumah tahfidz's leaderboard (rank
   * 1 is relative to that location's own students) and requires only
   * [assertLocationScope] — a location operator may view their own
   * location. Without it, this is the admin-only, school-wide leaderboard.
   */
  async getMemorizationLeaderboard(
    auth: AuthContext,
    scope: LeaderboardScope,
    date: string,
    locationId?: string,
  ) {
    if (locationId) {
      assertLocationScope(auth, locationId);
    } else {
      assertAdmin(auth);
    }

    const targets = await this.dailyTargets.list();
    const targetsByDay = new Map(targets.map((target) => [target.dayNumber, target]));

    interface CandidateRow {
      studentId: string;
      fullName: string;
      studentCode: string;
      locationId: string;
      locationName: string;
      kabKota: string | null;
      assessmentDate: string | null;
      achievedEndSurahNumber: number;
      achievedEndVerseNumber: number;
      dayNumber: number | null;
    }

    let candidates: CandidateRow[];
    if (scope === "DAILY") {
      const rows = await this.dashboards.getTodayMemorizationProgress(date);
      candidates = rows.map((row) => ({ ...row }));
    } else {
      const rows = await this.dashboards.getAggregateMemorizationProgress();
      candidates = rows
        .filter((row) => row.achievedEndSurahNumber !== null && row.achievedEndVerseNumber !== null)
        .map((row) => ({
          studentId: row.studentId,
          fullName: row.fullName,
          studentCode: row.studentCode,
          locationId: row.locationId,
          locationName: row.locationName,
          kabKota: row.kabKota,
          assessmentDate: row.latestAssessmentDate,
          achievedEndSurahNumber: row.achievedEndSurahNumber!,
          achievedEndVerseNumber: row.achievedEndVerseNumber!,
          dayNumber: computeDayNumber(date, row.programStartDate),
        }));
    }

    if (locationId) {
      candidates = candidates.filter((row) => row.locationId === locationId);
    }

    const items: LeaderboardItem[] = [];
    for (const row of candidates) {
      if (row.dayNumber === null) continue;
      const target = targetsByDay.get(row.dayNumber);
      if (!target) continue;

      const achievedIndex = cumulativeVerseIndex(this.quran, {
        surahNumber: row.achievedEndSurahNumber,
        verseNumber: row.achievedEndVerseNumber,
      });
      const targetIndex = cumulativeVerseIndex(this.quran, {
        surahNumber: target.endSurahNumber,
        verseNumber: target.endVerseNumber,
      });
      if (achievedIndex === null || targetIndex === null) continue;

      items.push({
        rank: 0,
        studentId: row.studentId,
        fullName: row.fullName,
        studentCode: row.studentCode,
        locationId: row.locationId,
        locationName: row.locationName,
        kabKota: row.kabKota,
        dayNumber: row.dayNumber,
        assessmentDate: row.assessmentDate,
        achievedEndSurahNumber: row.achievedEndSurahNumber,
        achievedEndVerseNumber: row.achievedEndVerseNumber,
        targetEndSurahNumber: target.endSurahNumber,
        targetEndVerseNumber: target.endVerseNumber,
        deltaVerses: achievedIndex - targetIndex,
        targetStatus: computeTargetStatus(
          row.achievedEndSurahNumber,
          row.achievedEndVerseNumber,
          target.endSurahNumber,
          target.endVerseNumber,
        ),
      });
    }

    items.sort((a, b) => b.deltaVerses - a.deltaVerses);
    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      scope,
      date,
      lastUpdatedAt: this.clock.nowIso(),
      data: items,
    };
  }

  /** Admin-only feed of today's activity photos across every location, most
   * recently uploaded first. */
  async getTodayActivityPhotos(auth: AuthContext, date: string) {
    assertAdmin(auth);
    const rows = await this.dashboards.getTodayActivityPhotos(date);
    const data: TodayActivityPhotoItem[] = await Promise.all(
      rows.map(async ({ objectKey, ...row }) => ({
        ...row,
        photoUrl: await this.objectStorage.createSignedDownloadUrl(objectKey),
      })),
    );
    return {
      date,
      lastUpdatedAt: this.clock.nowIso(),
      data,
    };
  }
}
