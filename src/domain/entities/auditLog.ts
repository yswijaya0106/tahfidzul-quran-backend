export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "PERMISSION_CHANGE"
  | "STUDENT_DOCUMENT_ACCESS"
  | "ASSESSMENT_CREATE"
  | "ASSESSMENT_UPDATE"
  | "ASSESSMENT_ARCHIVE"
  | "ARCHIVE"
  | "DELETE";

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}
