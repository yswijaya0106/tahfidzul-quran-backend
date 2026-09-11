import fs from "fs";
import path from "path";
import { createPool } from "./pool";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../migrations");

async function ensureMigrationsTable(pool: ReturnType<typeof createPool>): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(pool: ReturnType<typeof createPool>): Promise<Set<string>> {
  const [rows] = await pool.query<any[]>("SELECT id FROM schema_migrations");
  return new Set((rows as { id: string }[]).map((row) => row.id));
}

export async function runMigrations(migrationsDir: string = MIGRATIONS_DIR): Promise<void> {
  const pool = createPool();
  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedMigrations(pool);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const statements = sql
          .split(/;\s*(?:\r?\n|$)/)
          .map((statement) => statement.trim())
          .filter((statement) => statement.length > 0);
        for (const statement of statements) {
          await connection.query(statement);
        }
        await connection.query("INSERT INTO schema_migrations (id) VALUES (?)", [file]);
        await connection.commit();
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  } finally {
    await pool.end();
  }
}

/* v8 ignore start */
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Migrations complete.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
/* v8 ignore stop */
