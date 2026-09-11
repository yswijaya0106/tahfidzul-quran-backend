import { Pool, RowDataPacket } from "mysql2/promise";
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from "../../domain/repositories/refreshTokenRepository";
import { toSqlDateTime } from "../db/dateTime";

interface RefreshTokenRow extends RowDataPacket {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

function mapRow(row: RefreshTokenRow): StoredRefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export class MysqlRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(token: StoredRefreshToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        token.id,
        token.userId,
        token.tokenHash,
        toSqlDateTime(token.expiresAt),
        toSqlDateTime(token.createdAt),
      ],
    );
  }

  async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const [rows] = await this.pool.query<RefreshTokenRow[]>(
      "SELECT * FROM refresh_tokens WHERE token_hash = ?",
      [tokenHash],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?", [id]);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
      [userId],
    );
  }
}
