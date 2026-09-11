/** Converts an ISO 8601 timestamp to the "YYYY-MM-DD HH:MM:SS" format MySQL TIMESTAMP/DATETIME columns accept. */
export function toSqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

/** Converts an ISO 8601 date or datetime string to the "YYYY-MM-DD" format MySQL DATE columns accept. */
export function toSqlDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
