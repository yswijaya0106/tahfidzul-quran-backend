import { Pool, RowDataPacket } from "mysql2/promise";
import { LocationRepository, LocationFilters } from "../../domain/repositories/locationRepository";
import {
  Location,
  LocationOrganizationMember,
  LocationWithMembers,
} from "../../domain/entities/location";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { withTransaction } from "../db/pool";

interface LocationRow extends RowDataPacket {
  id: string;
  name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  description: string | null;
  cover_photo_object_key: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface MemberRow extends RowDataPacket {
  id: string;
  location_id: string;
  name: string;
  role_title: string;
  phone: string | null;
}

function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    phone: row.phone,
    description: row.description,
    coverPhotoObjectKey: row.cover_photo_object_key,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapMember(row: MemberRow): LocationOrganizationMember {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    roleTitle: row.role_title,
    phone: row.phone,
  };
}

export class MysqlLocationRepository implements LocationRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<LocationWithMembers | null> {
    const [rows] = await this.pool.query<LocationRow[]>("SELECT * FROM locations WHERE id = ?", [
      id,
    ]);
    if (!rows[0]) return null;

    const [memberRows] = await this.pool.query<MemberRow[]>(
      "SELECT * FROM location_organization_members WHERE location_id = ?",
      [id],
    );

    return { ...mapLocation(rows[0]), organizationMembers: memberRows.map(mapMember) };
  }

  async findActiveByName(name: string): Promise<Location | null> {
    const [rows] = await this.pool.query<LocationRow[]>(
      "SELECT * FROM locations WHERE name = ? AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1",
      [name],
    );
    return rows[0] ? mapLocation(rows[0]) : null;
  }

  async list(filters: LocationFilters, page: PageRequest): Promise<ListResult<Location>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push("(name LIKE ? OR address LIKE ?)");
      const term = `%${filters.search}%`;
      params.push(term, term);
    }
    if (filters.ids) {
      if (filters.ids.length === 0) {
        return { data: [], meta: { page: page.page, pageSize: page.pageSize, total: 0 } };
      }
      conditions.push(`id IN (${filters.ids.map(() => "?").join(",")})`);
      params.push(...filters.ids);
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM locations WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<LocationRow[]>(
      `SELECT * FROM locations WHERE ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapLocation),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(location: Location, members: LocationOrganizationMember[]): Promise<void> {
    await withTransaction(this.pool, async (connection) => {
      await connection.query(
        `INSERT INTO locations
          (id, name, address, latitude, longitude, phone, description, cover_photo_object_key, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          location.id,
          location.name,
          location.address,
          location.latitude,
          location.longitude,
          location.phone,
          location.description,
          location.coverPhotoObjectKey,
          location.status,
          location.createdAt,
          location.updatedAt,
        ],
      );

      for (const member of members) {
        await connection.query(
          `INSERT INTO location_organization_members (id, location_id, name, role_title, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [member.id, member.locationId, member.name, member.roleTitle, member.phone],
        );
      }
    });
  }

  async update(id: string, patch: Partial<Location>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      name: patch.name,
      address: patch.address,
      latitude: patch.latitude,
      longitude: patch.longitude,
      phone: patch.phone,
      description: patch.description,
      cover_photo_object_key: patch.coverPhotoObjectKey,
      status: patch.status,
      updated_at: patch.updatedAt,
      deleted_at: patch.deletedAt,
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
    await this.pool.query(`UPDATE locations SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async replaceMembers(locationId: string, members: LocationOrganizationMember[]): Promise<void> {
    await withTransaction(this.pool, async (connection) => {
      await connection.query("DELETE FROM location_organization_members WHERE location_id = ?", [
        locationId,
      ]);
      for (const member of members) {
        await connection.query(
          `INSERT INTO location_organization_members (id, location_id, name, role_title, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [member.id, locationId, member.name, member.roleTitle, member.phone],
        );
      }
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query("UPDATE locations SET deleted_at = NOW() WHERE id = ?", [id]);
  }
}
