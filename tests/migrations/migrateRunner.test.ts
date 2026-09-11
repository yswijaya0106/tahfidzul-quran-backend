import { afterAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { createPool } from "../../src/infrastructure/db/pool";
import { runMigrations } from "../../src/infrastructure/db/migrate";

const pool = createPool();

afterAll(async () => {
  await pool.end();
});

function makeTempMigrationsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrations-test-"));
  return dir;
}

describe("runMigrations", () => {
  it("applies a new migration file and records it as applied", async () => {
    const dir = makeTempMigrationsDir();
    const tableName = `tmp_migration_${uuid().replace(/-/g, "")}`;
    const fileName = `900_create_tmp_table_${uuid().replace(/-/g, "")}.sql`;
    fs.writeFileSync(
      path.join(dir, fileName),
      `CREATE TABLE ${tableName} (id CHAR(36) PRIMARY KEY);\n`,
    );

    await runMigrations(dir);

    const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
    expect((rows as unknown[]).length).toBe(1);

    const [migrationRows] = await pool.query("SELECT id FROM schema_migrations WHERE id = ?", [
      fileName,
    ]);
    expect((migrationRows as unknown[]).length).toBe(1);

    await pool.query(`DROP TABLE ${tableName}`);
    await pool.query("DELETE FROM schema_migrations WHERE id = ?", [fileName]);
  });

  it("skips a migration file that has already been applied", async () => {
    const dir = makeTempMigrationsDir();
    const tableName = `tmp_migration_${uuid().replace(/-/g, "")}`;
    const fileName = `901_create_tmp_table_${uuid().replace(/-/g, "")}.sql`;
    fs.writeFileSync(
      path.join(dir, fileName),
      `CREATE TABLE ${tableName} (id CHAR(36) PRIMARY KEY);\n`,
    );

    await runMigrations(dir);
    await expect(runMigrations(dir)).resolves.toBeUndefined();

    await pool.query(`DROP TABLE ${tableName}`);
    await pool.query("DELETE FROM schema_migrations WHERE id = ?", [fileName]);
  });

  it("rolls back and rethrows when a migration statement fails", async () => {
    const dir = makeTempMigrationsDir();
    const fileName = `902_invalid_${uuid().replace(/-/g, "")}.sql`;
    fs.writeFileSync(dir + `/${fileName}`, "THIS IS NOT VALID SQL;\n");

    await expect(runMigrations(dir)).rejects.toThrow();

    const [migrationRows] = await pool.query("SELECT id FROM schema_migrations WHERE id = ?", [
      fileName,
    ]);
    expect((migrationRows as unknown[]).length).toBe(0);
  });
});
