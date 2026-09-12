import { DashboardRepository, DateRange } from "../../domain/repositories/dashboardRepository";
import { StudentRepository } from "../../domain/repositories/studentRepository";
import { AppError } from "../../domain/errors";
import { computeTargetStatus, TargetStatus } from "../../domain/entities/dailyTarget";
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

export class DashboardUseCases {
  constructor(
    private readonly dashboards: DashboardRepository,
    private readonly students: StudentRepository,
    private readonly clock: Clock,
    private readonly objectStorage: ObjectStorage,
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
