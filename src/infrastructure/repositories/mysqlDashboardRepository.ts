import { Pool, RowDataPacket } from "mysql2/promise";
import {
  DashboardRepository,
  DateRange,
  LocationDashboardData,
  StudentDashboardData,
} from "../../domain/repositories/dashboardRepository";
import { AssessmentType } from "../../domain/entities/assessment";
import { Grade } from "../../domain/entities/grade";

const TYPES: AssessmentType[] = ["NEW_MEMORIZATION", "MUROJAAH"];

function emptyGradeDistribution(): Record<Grade, number> {
  return { MUMTAZ: 0, JAYYID_JIDDAN: 0, JAYYID: 0, MAQBUL: 0, RASIB: 0 };
}

function emptyTypeDistribution(): Record<AssessmentType, number> {
  return { NEW_MEMORIZATION: 0, MUROJAAH: 0 };
}

export class MysqlDashboardRepository implements DashboardRepository {
  constructor(private readonly pool: Pool) {}

  async getLocationDashboard(
    locationId: string,
    range: DateRange,
    inactivityThresholdDays: number,
  ): Promise<LocationDashboardData> {
    const [[activeCountRow]] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM students WHERE location_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL",
      [locationId],
    );

    const [assessmentRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT grade, assessment_type, assessment_date FROM memorization_assessments
       WHERE location_id = ? AND deleted_at IS NULL AND assessment_date BETWEEN ? AND ?`,
      [locationId, range.from, range.to],
    );

    const distributionByGrade = emptyGradeDistribution();
    const distributionByType = emptyTypeDistribution();
    let latestAssessmentDate: string | null = null;

    for (const row of assessmentRows as {
      grade: Grade;
      assessment_type: AssessmentType;
      assessment_date: Date;
    }[]) {
      distributionByGrade[row.grade] += 1;
      distributionByType[row.assessment_type] += 1;
      const dateStr = row.assessment_date.toISOString().slice(0, 10);
      if (!latestAssessmentDate || dateStr > latestAssessmentDate) {
        latestAssessmentDate = dateStr;
      }
    }

    const [inactiveRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT s.id AS student_id, s.full_name, s.student_code
       FROM students s
       LEFT JOIN memorization_assessments a
         ON a.student_id = s.id AND a.deleted_at IS NULL
         AND a.assessment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       WHERE s.location_id = ? AND s.status = 'ACTIVE' AND s.deleted_at IS NULL AND a.id IS NULL`,
      [inactivityThresholdDays, locationId],
    );

    const [activityRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id AS activity_id, title, activity_date FROM activities
       WHERE location_id = ? AND deleted_at IS NULL ORDER BY activity_date DESC LIMIT 10`,
      [locationId],
    );

    return {
      activeStudentCount: Number((activeCountRow as { count: number }).count),
      assessmentCount: assessmentRows.length,
      latestAssessmentDate,
      distributionByGrade,
      distributionByType,
      studentsWithoutRecentAssessment: (
        inactiveRows as { student_id: string; full_name: string; student_code: string }[]
      ).map((row) => ({
        studentId: row.student_id,
        fullName: row.full_name,
        studentCode: row.student_code,
      })),
      recentActivities: (
        activityRows as { activity_id: string; title: string; activity_date: Date }[]
      ).map((row) => ({
        activityId: row.activity_id,
        title: row.title,
        activityDate: row.activity_date.toISOString().slice(0, 10),
      })),
    };
  }

  async getStudentDashboard(studentId: string, range: DateRange): Promise<StudentDashboardData> {
    const [historyRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM memorization_assessments
       WHERE student_id = ? AND deleted_at IS NULL AND assessment_date BETWEEN ? AND ?
       ORDER BY assessment_date DESC, created_at DESC`,
      [studentId, range.from, range.to],
    );

    const distributionByGrade = emptyGradeDistribution();
    const coveredRanges: StudentDashboardData["coveredRanges"] = {
      NEW_MEMORIZATION: [],
      MUROJAAH: [],
    };

    for (const row of historyRows as any[]) {
      distributionByGrade[row.grade as Grade] += 1;
      coveredRanges[row.assessment_type as AssessmentType].push({
        startSurahNumber: row.start_surah_number,
        endSurahNumber: row.end_surah_number,
      });
    }

    let latestNewMemorization: unknown | null = null;
    let latestMurojaah: unknown | null = null;
    for (const type of TYPES) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT * FROM memorization_assessments
         WHERE student_id = ? AND assessment_type = ? AND deleted_at IS NULL
         ORDER BY assessment_date DESC, created_at DESC LIMIT 1`,
        [studentId, type],
      );
      if (type === "NEW_MEMORIZATION") latestNewMemorization = rows[0] ?? null;
      if (type === "MUROJAAH") latestMurojaah = rows[0] ?? null;
    }

    return {
      latestNewMemorization,
      latestMurojaah,
      history: historyRows,
      coveredRanges,
      distributionByGrade,
    };
  }
}
