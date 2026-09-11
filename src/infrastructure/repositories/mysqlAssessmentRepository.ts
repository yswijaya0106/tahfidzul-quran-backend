import { Pool, RowDataPacket } from "mysql2/promise";
import {
  AssessmentRepository,
  AssessmentFilters,
} from "../../domain/repositories/assessmentRepository";
import {
  AssessmentType,
  MemorizationAssessment,
  MemorizationAssessmentRevision,
} from "../../domain/entities/assessment";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { toSqlDate, toSqlDateTime } from "../db/dateTime";

interface AssessmentRow extends RowDataPacket {
  id: string;
  student_id: string;
  location_id: string;
  assessment_date: Date;
  assessment_type: AssessmentType;
  start_surah_number: number;
  start_verse_number: number;
  end_surah_number: number;
  end_verse_number: number;
  grade: MemorizationAssessment["grade"];
  notes: string | null;
  assessor_user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RevisionRow extends RowDataPacket {
  id: string;
  assessment_id: string;
  changed_by_user_id: string;
  change_type: MemorizationAssessmentRevision["changeType"];
  previous_value: string | null;
  new_value: string;
  created_at: Date;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapAssessment(row: AssessmentRow): MemorizationAssessment {
  return {
    id: row.id,
    studentId: row.student_id,
    locationId: row.location_id,
    assessmentDate: toDateOnly(row.assessment_date),
    assessmentType: row.assessment_type,
    startSurahNumber: row.start_surah_number,
    startVerseNumber: row.start_verse_number,
    endSurahNumber: row.end_surah_number,
    endVerseNumber: row.end_verse_number,
    grade: row.grade,
    notes: row.notes,
    assessorUserId: row.assessor_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapRevision(row: RevisionRow): MemorizationAssessmentRevision {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    changedByUserId: row.changed_by_user_id,
    changeType: row.change_type,
    previousValue: row.previous_value ? JSON.parse(row.previous_value) : null,
    newValue: JSON.parse(row.new_value),
    createdAt: row.created_at.toISOString(),
  };
}

export class MysqlAssessmentRepository implements AssessmentRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<MemorizationAssessment | null> {
    const [rows] = await this.pool.query<AssessmentRow[]>(
      "SELECT * FROM memorization_assessments WHERE id = ?",
      [id],
    );
    return rows[0] ? mapAssessment(rows[0]) : null;
  }

  async list(
    filters: AssessmentFilters,
    page: PageRequest,
  ): Promise<ListResult<MemorizationAssessment>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.studentId) {
      conditions.push("student_id = ?");
      params.push(filters.studentId);
    }
    if (filters.locationId) {
      conditions.push("location_id = ?");
      params.push(filters.locationId);
    }
    if (filters.locationIds) {
      if (filters.locationIds.length === 0) {
        return { data: [], meta: { page: page.page, pageSize: page.pageSize, total: 0 } };
      }
      conditions.push(`location_id IN (${filters.locationIds.map(() => "?").join(",")})`);
      params.push(...filters.locationIds);
    }
    if (filters.assessmentType) {
      conditions.push("assessment_type = ?");
      params.push(filters.assessmentType);
    }
    if (filters.dateFrom) {
      conditions.push("assessment_date >= ?");
      params.push(toSqlDate(filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push("assessment_date <= ?");
      params.push(toSqlDate(filters.dateTo));
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM memorization_assessments WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<AssessmentRow[]>(
      `SELECT * FROM memorization_assessments WHERE ${whereClause}
       ORDER BY assessment_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapAssessment),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(assessment: MemorizationAssessment): Promise<void> {
    await this.pool.query(
      `INSERT INTO memorization_assessments
        (id, student_id, location_id, assessment_date, assessment_type, start_surah_number,
         start_verse_number, end_surah_number, end_verse_number, grade, notes, assessor_user_id,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assessment.id,
        assessment.studentId,
        assessment.locationId,
        toSqlDate(assessment.assessmentDate),
        assessment.assessmentType,
        assessment.startSurahNumber,
        assessment.startVerseNumber,
        assessment.endSurahNumber,
        assessment.endVerseNumber,
        assessment.grade,
        assessment.notes,
        assessment.assessorUserId,
        toSqlDateTime(assessment.createdAt),
        toSqlDateTime(assessment.updatedAt),
      ],
    );
  }

  async update(id: string, patch: Partial<MemorizationAssessment>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      assessment_date:
        patch.assessmentDate !== undefined ? toSqlDate(patch.assessmentDate) : undefined,
      assessment_type: patch.assessmentType,
      start_surah_number: patch.startSurahNumber,
      start_verse_number: patch.startVerseNumber,
      end_surah_number: patch.endSurahNumber,
      end_verse_number: patch.endVerseNumber,
      grade: patch.grade,
      notes: patch.notes,
      updated_at: patch.updatedAt !== undefined ? toSqlDateTime(patch.updatedAt) : undefined,
      deleted_at:
        patch.deletedAt !== undefined
          ? patch.deletedAt === null
            ? null
            : toSqlDateTime(patch.deletedAt)
          : undefined,
    };

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (fields.length === 0) return;
    params.push(id);
    await this.pool.query(
      `UPDATE memorization_assessments SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
  }

  async archive(id: string): Promise<void> {
    await this.pool.query("UPDATE memorization_assessments SET deleted_at = NOW() WHERE id = ?", [
      id,
    ]);
  }

  async addRevision(revision: MemorizationAssessmentRevision): Promise<void> {
    await this.pool.query(
      `INSERT INTO memorization_assessment_revisions
        (id, assessment_id, changed_by_user_id, change_type, previous_value, new_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        revision.id,
        revision.assessmentId,
        revision.changedByUserId,
        revision.changeType,
        revision.previousValue ? JSON.stringify(revision.previousValue) : null,
        JSON.stringify(revision.newValue),
        toSqlDateTime(revision.createdAt),
      ],
    );
  }

  async listRevisions(assessmentId: string): Promise<MemorizationAssessmentRevision[]> {
    const [rows] = await this.pool.query<RevisionRow[]>(
      "SELECT * FROM memorization_assessment_revisions WHERE assessment_id = ? ORDER BY created_at ASC",
      [assessmentId],
    );
    return rows.map(mapRevision);
  }

  async findLatestForStudent(
    studentId: string,
    assessmentType: AssessmentType,
  ): Promise<MemorizationAssessment | null> {
    const [rows] = await this.pool.query<AssessmentRow[]>(
      `SELECT * FROM memorization_assessments
       WHERE student_id = ? AND assessment_type = ? AND deleted_at IS NULL
       ORDER BY assessment_date DESC, created_at DESC LIMIT 1`,
      [studentId, assessmentType],
    );
    return rows[0] ? mapAssessment(rows[0]) : null;
  }
}
