import { Pool, RowDataPacket } from "mysql2/promise";
import { IkhtibarRepository, IkhtibarFilters } from "../../domain/repositories/ikhtibarRepository";
import { Ikhtibar, IkhtibarRevision } from "../../domain/entities/ikhtibar";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { toSqlDate, toSqlDateTime } from "../db/dateTime";

interface IkhtibarRow extends RowDataPacket {
  id: string;
  student_id: string;
  location_id: string;
  exam_date: Date;
  juz_from: number;
  juz_to: number;
  grade: Ikhtibar["grade"];
  score: string | number;
  notes: string | null;
  assessor_user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RevisionRow extends RowDataPacket {
  id: string;
  ikhtibar_id: string;
  changed_by_user_id: string;
  change_type: IkhtibarRevision["changeType"];
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  created_at: Date;
}

function mapIkhtibar(row: IkhtibarRow): Ikhtibar {
  return {
    id: row.id,
    studentId: row.student_id,
    locationId: row.location_id,
    examDate: row.exam_date.toISOString().slice(0, 10),
    juzFrom: row.juz_from,
    juzTo: row.juz_to,
    grade: row.grade,
    score: Number(row.score),
    notes: row.notes,
    assessorUserId: row.assessor_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapRevision(row: RevisionRow): IkhtibarRevision {
  return {
    id: row.id,
    ikhtibarId: row.ikhtibar_id,
    changedByUserId: row.changed_by_user_id,
    changeType: row.change_type,
    previousValue: row.previous_value,
    newValue: row.new_value,
    createdAt: row.created_at.toISOString(),
  };
}

export class MysqlIkhtibarRepository implements IkhtibarRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Ikhtibar | null> {
    const [rows] = await this.pool.query<IkhtibarRow[]>("SELECT * FROM ikhtibar WHERE id = ?", [
      id,
    ]);
    return rows[0] ? mapIkhtibar(rows[0]) : null;
  }

  async list(filters: IkhtibarFilters, page: PageRequest): Promise<ListResult<Ikhtibar>> {
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
    if (filters.dateFrom) {
      conditions.push("exam_date >= ?");
      params.push(toSqlDate(filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push("exam_date <= ?");
      params.push(toSqlDate(filters.dateTo));
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ikhtibar WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<IkhtibarRow[]>(
      `SELECT * FROM ikhtibar WHERE ${whereClause}
       ORDER BY exam_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapIkhtibar),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(ikhtibar: Ikhtibar): Promise<void> {
    await this.pool.query(
      `INSERT INTO ikhtibar
        (id, student_id, location_id, exam_date, juz_from, juz_to, grade, score, notes,
         assessor_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ikhtibar.id,
        ikhtibar.studentId,
        ikhtibar.locationId,
        toSqlDate(ikhtibar.examDate),
        ikhtibar.juzFrom,
        ikhtibar.juzTo,
        ikhtibar.grade,
        ikhtibar.score,
        ikhtibar.notes,
        ikhtibar.assessorUserId,
        toSqlDateTime(ikhtibar.createdAt),
        toSqlDateTime(ikhtibar.updatedAt),
      ],
    );
  }

  async update(id: string, patch: Partial<Ikhtibar>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      exam_date: patch.examDate !== undefined ? toSqlDate(patch.examDate) : undefined,
      juz_from: patch.juzFrom,
      juz_to: patch.juzTo,
      grade: patch.grade,
      score: patch.score,
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
    await this.pool.query(`UPDATE ikhtibar SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async archive(id: string): Promise<void> {
    await this.pool.query("UPDATE ikhtibar SET deleted_at = NOW() WHERE id = ?", [id]);
  }

  async addRevision(revision: IkhtibarRevision): Promise<void> {
    await this.pool.query(
      `INSERT INTO ikhtibar_revisions
        (id, ikhtibar_id, changed_by_user_id, change_type, previous_value, new_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        revision.id,
        revision.ikhtibarId,
        revision.changedByUserId,
        revision.changeType,
        revision.previousValue ? JSON.stringify(revision.previousValue) : null,
        JSON.stringify(revision.newValue),
        toSqlDateTime(revision.createdAt),
      ],
    );
  }

  async listRevisions(ikhtibarId: string): Promise<IkhtibarRevision[]> {
    const [rows] = await this.pool.query<RevisionRow[]>(
      "SELECT * FROM ikhtibar_revisions WHERE ikhtibar_id = ? ORDER BY created_at ASC",
      [ikhtibarId],
    );
    return rows.map(mapRevision);
  }
}
