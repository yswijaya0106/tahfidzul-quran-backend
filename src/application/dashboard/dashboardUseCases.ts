import { DashboardRepository, DateRange } from "../../domain/repositories/dashboardRepository";
import { StudentRepository } from "../../domain/repositories/studentRepository";
import { AppError } from "../../domain/errors";
import { AuthContext, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";

export interface DashboardEnvelope<T> {
  range: DateRange;
  timezone: string;
  lastUpdatedAt: string;
  data: T;
}

const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 14;

export class DashboardUseCases {
  constructor(
    private readonly dashboards: DashboardRepository,
    private readonly students: StudentRepository,
    private readonly clock: Clock,
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
    return {
      range,
      timezone,
      lastUpdatedAt: this.clock.nowIso(),
      data,
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
}
