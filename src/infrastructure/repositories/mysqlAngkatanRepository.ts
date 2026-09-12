import { Pool, RowDataPacket } from "mysql2/promise";
import { AngkatanRepository, AngkatanFilters } from "../../domain/repositories/angkatanRepository";
import { Angkatan } from "../../domain/entities/angkatan";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { toSqlDate, toSqlDateTime } from "../db/dateTime";

interface AngkatanRow extends RowDataPacket {
  id: string;
  location_id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function mapAngkatan(row: AngkatanRow): Angkatan {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    startDate: row.start_date.toISOString().slice(0, 10),
    endDate: row.end_date.toISOString().slice(0, 10),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export class MysqlAngkatanRepository implements AngkatanRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Angkatan | null> {
    const [rows] = await this.pool.query<AngkatanRow[]>("SELECT * FROM angkatan WHERE id = ?", [
      id,
    ]);
    return rows[0] ? mapAngkatan(rows[0]) : null;
  }

  async findActiveByName(locationId: string, name: string): Promise<Angkatan | null> {
    const [rows] = await this.pool.query<AngkatanRow[]>(
      "SELECT * FROM angkatan WHERE location_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1",
      [locationId, name],
    );
    return rows[0] ? mapAngkatan(rows[0]) : null;
  }

  async list(filters: AngkatanFilters, page: PageRequest): Promise<ListResult<Angkatan>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.search) {
      conditions.push("name LIKE ?");
      params.push(`%${filters.search}%`);
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

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM angkatan WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<AngkatanRow[]>(
      `SELECT * FROM angkatan WHERE ${whereClause} ORDER BY start_date DESC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapAngkatan),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(angkatan: Angkatan): Promise<void> {
    await this.pool.query(
      `INSERT INTO angkatan (id, location_id, name, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        angkatan.id,
        angkatan.locationId,
        angkatan.name,
        toSqlDate(angkatan.startDate),
        toSqlDate(angkatan.endDate),
        toSqlDateTime(angkatan.createdAt),
        toSqlDateTime(angkatan.updatedAt),
      ],
    );
  }

  async update(id: string, patch: Partial<Angkatan>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      name: patch.name,
      start_date: patch.startDate !== undefined ? toSqlDate(patch.startDate) : undefined,
      end_date: patch.endDate !== undefined ? toSqlDate(patch.endDate) : undefined,
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
    await this.pool.query(`UPDATE angkatan SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query("UPDATE angkatan SET deleted_at = NOW() WHERE id = ?", [id]);
  }

  async hasStudents(id: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM students WHERE angkatan_id = ? AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    return rows.length > 0;
  }
}
