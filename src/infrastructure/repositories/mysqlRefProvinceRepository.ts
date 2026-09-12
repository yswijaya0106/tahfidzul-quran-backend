import { Pool, RowDataPacket } from "mysql2/promise";
import { RefProvinceRepository } from "../../domain/repositories/refProvinceRepository";
import { RefProvince } from "../../domain/entities/refProvince";

interface RefProvinceRow extends RowDataPacket {
  id: number;
  province_name: string | null;
}

function mapRow(row: RefProvinceRow): RefProvince {
  return { id: row.id, provinceName: row.province_name };
}

export class MysqlRefProvinceRepository implements RefProvinceRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<RefProvince[]> {
    const [rows] = await this.pool.query<RefProvinceRow[]>(
      "SELECT id, province_name FROM ref_province WHERE deleted_at IS NULL ORDER BY province_name ASC",
    );
    return rows.map(mapRow);
  }

  async findById(id: number): Promise<RefProvince | null> {
    const [rows] = await this.pool.query<RefProvinceRow[]>(
      "SELECT id, province_name FROM ref_province WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
