import { v4 as uuid } from "uuid";
import { createPool } from "./pool";
import { BcryptPasswordHasher } from "../auth/bcryptPasswordHasher";

/**
 * Bootstraps a single ADMIN user for local development. Run once against an
 * empty database: `npm run seed:admin -- admin@example.com StrongPassw0rd!`
 */
async function seedAdmin(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run seed:admin -- <email> <password>");
    process.exit(1);
  }

  const pool = createPool();
  try {
    const hasher = new BcryptPasswordHasher();
    const passwordHash = await hasher.hash(password);
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ADMIN', 1, ?, ?)`,
      [uuid(), "System Administrator", email, passwordHash, now, now],
    );

    console.log(`Admin user created: ${email}`);
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin user:", error);
  process.exit(1);
});
