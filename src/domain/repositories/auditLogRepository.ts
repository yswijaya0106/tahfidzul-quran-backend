import { AuditLog } from "../entities/auditLog";

export interface AuditLogRepository {
  record(entry: AuditLog): Promise<void>;
}
