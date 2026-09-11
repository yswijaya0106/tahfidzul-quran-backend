import { Pool, RowDataPacket } from "mysql2/promise";
import { UserRepository, UserFilters } from "../../domain/repositories/userRepository";
import { User, UserLocationAssignment } from "../../domain/entities/user";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";

interface UserRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  role: "ADMIN" | "LOCATION_OPERATOR";
  is_active: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export class MysqlUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const [rows] = await this.pool.query<UserRow[]>("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    const [rows] = await this.pool.query<UserRow[]>(
      "SELECT * FROM users WHERE (email = ? OR phone = ?) AND deleted_at IS NULL LIMIT 1",
      [identifier, identifier],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async list(filters: UserFilters, page: PageRequest): Promise<ListResult<User>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.role) {
      conditions.push("role = ?");
      params.push(filters.role);
    }
    if (filters.isActive !== undefined) {
      conditions.push("is_active = ?");
      params.push(filters.isActive ? 1 : 0);
    }
    if (filters.search) {
      conditions.push("(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<UserRow[]>(
      `SELECT * FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapRow),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.fullName,
        user.email,
        user.phone,
        user.passwordHash,
        user.role,
        user.isActive ? 1 : 0,
        user.createdAt,
        user.updatedAt,
      ],
    );
  }

  async update(id: string, patch: Partial<User>): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];

    const columnMap: Record<string, unknown> = {
      full_name: patch.fullName,
      email: patch.email,
      phone: patch.phone,
      role: patch.role,
      is_active: patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : undefined,
      updated_at: patch.updatedAt,
      deleted_at: patch.deletedAt,
    };

    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) return;
    params.push(id);
    await this.pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async getAssignedLocationIds(userId: string): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT location_id FROM user_location_assignments WHERE user_id = ?",
      [userId],
    );
    return (rows as { location_id: string }[]).map((row) => row.location_id);
  }

  async assignLocations(userId: string, locationIds: string[]): Promise<void> {
    await this.pool.query("DELETE FROM user_location_assignments WHERE user_id = ?", [userId]);
    if (locationIds.length === 0) return;

    const values = locationIds.map(() => "(?, ?, ?, NOW())").join(", ");
    const params = locationIds.flatMap((locationId) => [crypto.randomUUID(), userId, locationId]);
    await this.pool.query(
      `INSERT INTO user_location_assignments (id, user_id, location_id, created_at) VALUES ${values}`,
      params,
    );
  }

  async listAssignments(userId: string): Promise<UserLocationAssignment[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id, user_id, location_id, created_at FROM user_location_assignments WHERE user_id = ?",
      [userId],
    );
    return (
      rows as {
        id: string;
        user_id: string;
        location_id: string;
        created_at: Date;
      }[]
    ).map((row) => ({
      id: row.id,
      userId: row.user_id,
      locationId: row.location_id,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
