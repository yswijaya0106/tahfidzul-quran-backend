import { Pool } from "mysql2/promise";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AuditLog } from "../../domain/entities/auditLog";
import { toSqlDateTime } from "../db/dateTime";

export class MysqlAuditLogRepository implements AuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(entry: AuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, context, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.actorUserId,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.context ? JSON.stringify(entry.context) : null,
        toSqlDateTime(entry.createdAt),
      ],
    );
  }
}
