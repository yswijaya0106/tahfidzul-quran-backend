import { AssessmentGrade, AssessmentType } from "../entities/assessment";

export interface DateRange {
  from: string;
  to: string;
}

export interface LocationDashboardData {
  activeStudentCount: number;
  assessmentCount: number;
  latestAssessmentDate: string | null;
  distributionByGrade: Record<AssessmentGrade, number>;
  distributionByType: Record<AssessmentType, number>;
  studentsWithoutRecentAssessment: { studentId: string; fullName: string; studentCode: string }[];
  recentActivities: { activityId: string; title: string; activityDate: string }[];
}

export interface StudentDashboardData {
  latestNewMemorization: unknown | null;
  latestMurojaah: unknown | null;
  history: unknown[];
  coveredRanges: Record<AssessmentType, { startSurahNumber: number; endSurahNumber: number }[]>;
  distributionByGrade: Record<AssessmentGrade, number>;
}

export interface DashboardRepository {
  getLocationDashboard(
    locationId: string,
    range: DateRange,
    inactivityThresholdDays: number,
  ): Promise<LocationDashboardData>;
  getStudentDashboard(studentId: string, range: DateRange): Promise<StudentDashboardData>;
}
