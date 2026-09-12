import { Pool, RowDataPacket } from "mysql2/promise";
import { RefCityRepository } from "../../domain/repositories/refCityRepository";
import { RefCity } from "../../domain/entities/refCity";

interface RefCityRow extends RowDataPacket {
  id: number;
  city_name: string | null;
  province_id: number | null;
}

function mapRow(row: RefCityRow): RefCity {
  return { id: row.id, cityName: row.city_name, provinceId: row.province_id };
}

export class MysqlRefCityRepository implements RefCityRepository {
  constructor(private readonly pool: Pool) {}

  async list(provinceId?: number): Promise<RefCity[]> {
    if (provinceId !== undefined) {
      const [rows] = await this.pool.query<RefCityRow[]>(
        "SELECT id, city_name, province_id FROM ref_city WHERE deleted_at IS NULL AND province_id = ? ORDER BY city_name ASC",
        [provinceId],
      );
      return rows.map(mapRow);
    }

    const [rows] = await this.pool.query<RefCityRow[]>(
      "SELECT id, city_name, province_id FROM ref_city WHERE deleted_at IS NULL ORDER BY city_name ASC",
    );
    return rows.map(mapRow);
  }

  async findById(id: number): Promise<RefCity | null> {
    const [rows] = await this.pool.query<RefCityRow[]>(
      "SELECT id, city_name, province_id FROM ref_city WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
