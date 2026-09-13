import { Pool, RowDataPacket } from "mysql2/promise";
import {
  DashboardRepository,
  DateRange,
  LocationDashboardData,
  LocationOverviewItem,
  StudentAggregateProgressRow,
  StudentDashboardData,
  StudentMemorizationProgressRow,
  TodayActivityPhotoRow,
} from "../../domain/repositories/dashboardRepository";
import { AssessmentType } from "../../domain/entities/assessment";
import { Grade } from "../../domain/entities/grade";
import { LocationStatus } from "../../domain/entities/location";

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
      `SELECT a.id AS activity_id, a.title, a.activity_date, p.object_key AS thumbnail_object_key
       FROM activities a
       LEFT JOIN activity_photos p
         ON p.activity_id = a.id AND p.deleted_at IS NULL AND p.display_order = (
           SELECT MIN(p2.display_order) FROM activity_photos p2
           WHERE p2.activity_id = a.id AND p2.deleted_at IS NULL
         )
       WHERE a.location_id = ? AND a.deleted_at IS NULL ORDER BY a.activity_date DESC LIMIT 10`,
      [locationId],
    );

    const [topStudentRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         s.id AS student_id,
         s.full_name,
         s.student_code,
         COUNT(a.id) AS assessment_count,
         SUM(CASE WHEN a.grade = 'MUMTAZ' THEN 1 ELSE 0 END) AS mumtaz_count
       FROM students s
       JOIN memorization_assessments a
         ON a.student_id = s.id AND a.deleted_at IS NULL
         AND a.assessment_date BETWEEN ? AND ?
       WHERE s.location_id = ? AND s.deleted_at IS NULL
       GROUP BY s.id, s.full_name, s.student_code
       ORDER BY assessment_count DESC, mumtaz_count DESC
       LIMIT 10`,
      [range.from, range.to, locationId],
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
        activityRows as {
          activity_id: string;
          title: string;
          activity_date: Date;
          thumbnail_object_key: string | null;
        }[]
      ).map((row) => ({
        activityId: row.activity_id,
        title: row.title,
        activityDate: row.activity_date.toISOString().slice(0, 10),
        thumbnailObjectKey: row.thumbnail_object_key,
      })),
      topStudents: (
        topStudentRows as {
          student_id: string;
          full_name: string;
          student_code: string;
          assessment_count: number;
          mumtaz_count: number;
        }[]
      ).map((row) => ({
        studentId: row.student_id,
        fullName: row.full_name,
        studentCode: row.student_code,
        assessmentCount: Number(row.assessment_count),
        mumtazCount: Number(row.mumtaz_count),
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

  async getLocationsOverview(date: string): Promise<LocationOverviewItem[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         l.id AS location_id,
         l.name AS location_name,
         l.kab_kota AS kab_kota,
         l.status AS status,
         (SELECT COUNT(*) FROM students s
           WHERE s.location_id = l.id AND s.status = 'ACTIVE' AND s.deleted_at IS NULL) AS active_student_count,
         (SELECT COUNT(*) FROM memorization_assessments a
           WHERE a.location_id = l.id AND a.deleted_at IS NULL AND a.assessment_date = ?) AS assessments_today,
         (SELECT COUNT(*) FROM activities act
           WHERE act.location_id = l.id AND act.deleted_at IS NULL AND act.activity_date = ?) AS activities_today,
         (SELECT COUNT(*) FROM activity_photos p
           JOIN activities act2 ON act2.id = p.activity_id
           WHERE act2.location_id = l.id AND act2.activity_date = ? AND p.deleted_at IS NULL) AS photos_today,
         (SELECT MAX(a3.created_at) FROM memorization_assessments a3
           WHERE a3.location_id = l.id AND a3.deleted_at IS NULL) AS last_assessment_at,
         (SELECT MAX(act3.created_at) FROM activities act3
           WHERE act3.location_id = l.id AND act3.deleted_at IS NULL) AS last_activity_at
       FROM locations l
       WHERE l.deleted_at IS NULL
       ORDER BY l.name ASC`,
      [date, date, date],
    );

    return (
      rows as {
        location_id: string;
        location_name: string;
        kab_kota: string | null;
        status: LocationStatus;
        active_student_count: number;
        assessments_today: number;
        activities_today: number;
        photos_today: number;
        last_assessment_at: Date | null;
        last_activity_at: Date | null;
      }[]
    ).map((row) => ({
      locationId: row.location_id,
      locationName: row.location_name,
      kabKota: row.kab_kota,
      status: row.status,
      activeStudentCount: Number(row.active_student_count),
      assessmentsToday: Number(row.assessments_today),
      activitiesToday: Number(row.activities_today),
      photosToday: Number(row.photos_today),
      lastAssessmentAt: row.last_assessment_at ? row.last_assessment_at.toISOString() : null,
      lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    }));
  }

  async getTodayMemorizationProgress(date: string): Promise<StudentMemorizationProgressRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         s.id AS student_id,
         s.full_name,
         s.student_code,
         s.location_id,
         l.name AS location_name,
         l.kab_kota AS kab_kota,
         a.assessment_date,
         a.end_surah_number AS achieved_end_surah_number,
         a.end_verse_number AS achieved_end_verse_number,
         a.day_number,
         dt.end_surah_number AS target_end_surah_number,
         dt.end_verse_number AS target_end_verse_number
       FROM students s
       JOIN locations l ON l.id = s.location_id
       JOIN memorization_assessments a ON a.id = (
         SELECT a2.id FROM memorization_assessments a2
         WHERE a2.student_id = s.id
           AND a2.assessment_type = 'NEW_MEMORIZATION'
           AND a2.deleted_at IS NULL
           AND a2.assessment_date = ?
         ORDER BY a2.created_at DESC
         LIMIT 1
       )
       LEFT JOIN daily_targets dt ON dt.day_number = a.day_number
       WHERE s.status = 'ACTIVE' AND s.deleted_at IS NULL
       ORDER BY l.name ASC, s.full_name ASC`,
      [date],
    );

    return (
      rows as {
        student_id: string;
        full_name: string;
        student_code: string;
        location_id: string;
        location_name: string;
        kab_kota: string | null;
        assessment_date: Date;
        achieved_end_surah_number: number;
        achieved_end_verse_number: number;
        day_number: number | null;
        target_end_surah_number: number | null;
        target_end_verse_number: number | null;
      }[]
    ).map((row) => ({
      studentId: row.student_id,
      fullName: row.full_name,
      studentCode: row.student_code,
      locationId: row.location_id,
      locationName: row.location_name,
      kabKota: row.kab_kota,
      assessmentDate: row.assessment_date.toISOString().slice(0, 10),
      achievedEndSurahNumber: Number(row.achieved_end_surah_number),
      achievedEndVerseNumber: Number(row.achieved_end_verse_number),
      dayNumber: row.day_number === null ? null : Number(row.day_number),
      targetEndSurahNumber:
        row.target_end_surah_number === null ? null : Number(row.target_end_surah_number),
      targetEndVerseNumber:
        row.target_end_verse_number === null ? null : Number(row.target_end_verse_number),
    }));
  }

  async getAggregateMemorizationProgress(): Promise<StudentAggregateProgressRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         s.id AS student_id,
         s.full_name,
         s.student_code,
         s.location_id,
         l.name AS location_name,
         l.kab_kota AS kab_kota,
         s.program_start_date,
         a.assessment_date AS latest_assessment_date,
         a.end_surah_number AS achieved_end_surah_number,
         a.end_verse_number AS achieved_end_verse_number
       FROM students s
       JOIN locations l ON l.id = s.location_id
       LEFT JOIN memorization_assessments a ON a.id = (
         SELECT a2.id FROM memorization_assessments a2
         WHERE a2.student_id = s.id
           AND a2.assessment_type = 'NEW_MEMORIZATION'
           AND a2.deleted_at IS NULL
         ORDER BY a2.assessment_date DESC, a2.created_at DESC
         LIMIT 1
       )
       WHERE s.status = 'ACTIVE' AND s.deleted_at IS NULL AND s.program_start_date IS NOT NULL
       ORDER BY l.name ASC, s.full_name ASC`,
    );

    return (
      rows as {
        student_id: string;
        full_name: string;
        student_code: string;
        location_id: string;
        location_name: string;
        kab_kota: string | null;
        program_start_date: Date | null;
        latest_assessment_date: Date | null;
        achieved_end_surah_number: number | null;
        achieved_end_verse_number: number | null;
      }[]
    ).map((row) => ({
      studentId: row.student_id,
      fullName: row.full_name,
      studentCode: row.student_code,
      locationId: row.location_id,
      locationName: row.location_name,
      kabKota: row.kab_kota,
      programStartDate: row.program_start_date
        ? row.program_start_date.toISOString().slice(0, 10)
        : null,
      latestAssessmentDate: row.latest_assessment_date
        ? row.latest_assessment_date.toISOString().slice(0, 10)
        : null,
      achievedEndSurahNumber:
        row.achieved_end_surah_number === null ? null : Number(row.achieved_end_surah_number),
      achievedEndVerseNumber:
        row.achieved_end_verse_number === null ? null : Number(row.achieved_end_verse_number),
    }));
  }

  async getTodayActivityPhotos(date: string): Promise<TodayActivityPhotoRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         p.id AS photo_id,
         p.object_key AS object_key,
         p.caption AS caption,
         p.created_at AS uploaded_at,
         a.id AS activity_id,
         a.title AS activity_title,
         l.id AS location_id,
         l.name AS location_name,
         l.kab_kota AS kab_kota
       FROM activity_photos p
       JOIN activities a ON a.id = p.activity_id AND a.deleted_at IS NULL
       JOIN locations l ON l.id = a.location_id AND l.deleted_at IS NULL
       WHERE a.activity_date = ? AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [date],
    );

    return (
      rows as {
        photo_id: string;
        object_key: string;
        caption: string | null;
        uploaded_at: Date;
        activity_id: string;
        activity_title: string;
        location_id: string;
        location_name: string;
        kab_kota: string | null;
      }[]
    ).map((row) => ({
      photoId: row.photo_id,
      objectKey: row.object_key,
      caption: row.caption,
      uploadedAt: row.uploaded_at.toISOString(),
      activityId: row.activity_id,
      activityTitle: row.activity_title,
      locationId: row.location_id,
      locationName: row.location_name,
      kabKota: row.kab_kota,
    }));
  }
}
