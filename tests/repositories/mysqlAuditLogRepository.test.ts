import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlAuditLogRepository } from "../../src/infrastructure/repositories/mysqlAuditLogRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";

let pool: Pool;
let repo: MysqlAuditLogRepository;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlAuditLogRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("MysqlAuditLogRepository", () => {
  it("records an audit log entry with context", async () => {
    const id = uuid();
    await repo.record({
      id,
      actorUserId: null,
      action: "LOGIN",
      resourceType: "user",
      resourceId: "user-1",
      context: { scope: "current-device" },
      createdAt: new Date().toISOString(),
    });

    const [rows] = await pool.query("SELECT * FROM audit_logs WHERE id = ?", [id]);
    expect((rows as unknown[]).length).toBe(1);
  });

  it("records an audit log entry without context", async () => {
    const id = uuid();
    await repo.record({
      id,
      actorUserId: null,
      action: "LOGOUT",
      resourceType: "user",
      resourceId: "user-1",
      context: null,
      createdAt: new Date().toISOString(),
    });

    const [rows] = await pool.query<any[]>("SELECT context FROM audit_logs WHERE id = ?", [id]);
    expect(rows[0].context).toBeNull();
  });
});
