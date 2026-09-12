import { AssessmentGrade, AssessmentType } from "../entities/assessment";
import { LocationStatus } from "../entities/location";

export interface DateRange {
  from: string;
  to: string;
}

export interface LocationOverviewItem {
  locationId: string;
  locationName: string;
  kabKota: string | null;
  status: LocationStatus;
  activeStudentCount: number;
  assessmentsToday: number;
  activitiesToday: number;
  photosToday: number;
  lastAssessmentAt: string | null;
  lastActivityAt: string | null;
}

export interface TopStudent {
  studentId: string;
  fullName: string;
  studentCode: string;
  assessmentCount: number;
  mumtazCount: number;
}

export interface LocationDashboardData {
  activeStudentCount: number;
  assessmentCount: number;
  latestAssessmentDate: string | null;
  distributionByGrade: Record<AssessmentGrade, number>;
  distributionByType: Record<AssessmentType, number>;
  studentsWithoutRecentAssessment: { studentId: string; fullName: string; studentCode: string }[];
  recentActivities: {
    activityId: string;
    title: string;
    activityDate: string;
    thumbnailObjectKey: string | null;
  }[];
  /** Top 10 most active students by assessment count within the selected range. */
  topStudents: TopStudent[];
}

/** Raw per-student facts for today's new-memorization submissions, before
 * the application layer derives whether the daily target was reached. */
export interface StudentMemorizationProgressRow {
  studentId: string;
  fullName: string;
  studentCode: string;
  locationId: string;
  locationName: string;
  kabKota: string | null;
  assessmentDate: string;
  achievedEndSurahNumber: number;
  achievedEndVerseNumber: number;
  /** Program day (1-300) derived from the student's program_start_date, or
   * null if that date isn't set. */
  dayNumber: number | null;
  /** The daily_targets row for dayNumber, or null if unseeded/unknown. */
  targetEndSurahNumber: number | null;
  targetEndVerseNumber: number | null;
}

export interface StudentDashboardData {
  latestNewMemorization: unknown | null;
  latestMurojaah: unknown | null;
  history: unknown[];
  coveredRanges: Record<AssessmentType, { startSurahNumber: number; endSurahNumber: number }[]>;
  distributionByGrade: Record<AssessmentGrade, number>;
}

/** A single activity photo uploaded today, with enough context (activity +
 * location) to render it in the cross-location admin feed without a second
 * lookup. */
export interface TodayActivityPhotoRow {
  photoId: string;
  objectKey: string;
  caption: string | null;
  uploadedAt: string;
  activityId: string;
  activityTitle: string;
  locationId: string;
  locationName: string;
  kabKota: string | null;
}

export interface DashboardRepository {
  getLocationDashboard(
    locationId: string,
    range: DateRange,
    inactivityThresholdDays: number,
  ): Promise<LocationDashboardData>;
  getStudentDashboard(studentId: string, range: DateRange): Promise<StudentDashboardData>;
  /** Per-location submission progress for a single day, across all non-deleted locations. */
  getLocationsOverview(date: string): Promise<LocationOverviewItem[]>;
  /** Active students who submitted a new-memorization assessment on the given day. */
  getTodayMemorizationProgress(date: string): Promise<StudentMemorizationProgressRow[]>;
  /** All activity photos uploaded on the given day across every non-deleted
   * location, most recently uploaded first. */
  getTodayActivityPhotos(date: string): Promise<TodayActivityPhotoRow[]>;
}
