import { Pool, RowDataPacket } from "mysql2/promise";
import { ActivityRepository, ActivityFilters } from "../../domain/repositories/activityRepository";
import { Activity, ActivityPhoto } from "../../domain/entities/activity";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { withTransaction } from "../db/pool";
import { toSqlDate, toSqlDateTime } from "../db/dateTime";

interface ActivityRow extends RowDataPacket {
  id: string;
  location_id: string;
  title: string;
  description: string | null;
  activity_date: Date;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface PhotoRow extends RowDataPacket {
  id: string;
  activity_id: string;
  object_key: string;
  caption: string | null;
  display_order: number;
  thumbnail_object_key: string | null;
  processing_status: ActivityPhoto["processingStatus"];
  created_at: Date;
  deleted_at: Date | null;
}

function mapActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    locationId: row.location_id,
    title: row.title,
    description: row.description,
    activityDate: row.activity_date.toISOString().slice(0, 10),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapPhoto(row: PhotoRow): ActivityPhoto {
  return {
    id: row.id,
    activityId: row.activity_id,
    objectKey: row.object_key,
    caption: row.caption,
    displayOrder: row.display_order,
    thumbnailObjectKey: row.thumbnail_object_key,
    processingStatus: row.processing_status,
    createdAt: row.created_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export class MysqlActivityRepository implements ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Activity | null> {
    const [rows] = await this.pool.query<ActivityRow[]>("SELECT * FROM activities WHERE id = ?", [
      id,
    ]);
    return rows[0] ? mapActivity(rows[0]) : null;
  }

  async list(filters: ActivityFilters, page: PageRequest): Promise<ListResult<Activity>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.locationId) {
      conditions.push("location_id = ?");
      params.push(filters.locationId);
    }
    if (filters.dateFrom) {
      conditions.push("activity_date >= ?");
      params.push(toSqlDate(filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push("activity_date <= ?");
      params.push(toSqlDate(filters.dateTo));
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM activities WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<ActivityRow[]>(
      `SELECT * FROM activities WHERE ${whereClause} ORDER BY activity_date DESC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapActivity),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(activity: Activity, photos: ActivityPhoto[]): Promise<void> {
    await withTransaction(this.pool, async (connection) => {
      await connection.query(
        `INSERT INTO activities
          (id, location_id, title, description, activity_date, created_by_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          activity.id,
          activity.locationId,
          activity.title,
          activity.description,
          toSqlDate(activity.activityDate),
          activity.createdByUserId,
          toSqlDateTime(activity.createdAt),
          toSqlDateTime(activity.updatedAt),
        ],
      );

      for (const photo of photos) {
        await connection.query(
          `INSERT INTO activity_photos
            (id, activity_id, object_key, caption, display_order, processing_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            photo.id,
            photo.activityId,
            photo.objectKey,
            photo.caption,
            photo.displayOrder,
            photo.processingStatus,
            toSqlDateTime(photo.createdAt),
          ],
        );
      }
    });
  }

  async update(id: string, patch: Partial<Activity>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      title: patch.title,
      description: patch.description,
      activity_date: patch.activityDate !== undefined ? toSqlDate(patch.activityDate) : undefined,
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
    await this.pool.query(`UPDATE activities SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async archive(id: string): Promise<void> {
    await this.pool.query("UPDATE activities SET deleted_at = NOW() WHERE id = ?", [id]);
  }

  async replacePhotos(activityId: string, photos: ActivityPhoto[]): Promise<void> {
    await withTransaction(this.pool, async (connection) => {
      await connection.query("DELETE FROM activity_photos WHERE activity_id = ?", [activityId]);
      for (const photo of photos) {
        await connection.query(
          `INSERT INTO activity_photos
            (id, activity_id, object_key, caption, display_order, processing_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            photo.id,
            activityId,
            photo.objectKey,
            photo.caption,
            photo.displayOrder,
            photo.processingStatus,
            toSqlDateTime(photo.createdAt),
          ],
        );
      }
    });
  }

  async listPhotos(activityId: string): Promise<ActivityPhoto[]> {
    const [rows] = await this.pool.query<PhotoRow[]>(
      "SELECT * FROM activity_photos WHERE activity_id = ? AND deleted_at IS NULL ORDER BY display_order ASC",
      [activityId],
    );
    return rows.map(mapPhoto);
  }
}
