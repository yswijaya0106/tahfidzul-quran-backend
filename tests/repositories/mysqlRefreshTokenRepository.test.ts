import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlRefreshTokenRepository } from "../../src/infrastructure/repositories/mysqlRefreshTokenRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { StoredRefreshToken } from "../../src/domain/repositories/refreshTokenRepository";

let pool: Pool;
let repo: MysqlRefreshTokenRepository;
let userId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlRefreshTokenRepository(pool);
  userId = await createUser(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeToken(overrides: Partial<StoredRefreshToken> = {}): StoredRefreshToken {
  return {
    id: uuid(),
    userId,
    tokenHash: uuid(),
    expiresAt: "2030-01-01T00:00:00.000Z",
    revokedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("MysqlRefreshTokenRepository", () => {
  it("creates and finds a refresh token by hash", async () => {
    const token = makeToken();
    await repo.create(token);

    const found = await repo.findByTokenHash(token.tokenHash);
    expect(found?.id).toBe(token.id);
    expect(found?.revokedAt).toBeNull();
  });

  it("returns null for an unknown hash", async () => {
    expect(await repo.findByTokenHash("unknown")).toBeNull();
  });

  it("revokes a token by id", async () => {
    const token = makeToken();
    await repo.create(token);
    await repo.revoke(token.id);

    const found = await repo.findByTokenHash(token.tokenHash);
    expect(found?.revokedAt).not.toBeNull();
  });

  it("revokes all tokens for a user without touching already-revoked ones", async () => {
    const a = makeToken();
    const b = makeToken();
    await repo.create(a);
    await repo.create(b);
    await repo.revoke(a.id);

    await repo.revokeAllForUser(userId);

    const foundA = await repo.findByTokenHash(a.tokenHash);
    const foundB = await repo.findByTokenHash(b.tokenHash);
    expect(foundA?.revokedAt).not.toBeNull();
    expect(foundB?.revokedAt).not.toBeNull();
  });
});

async function createUser(pool: Pool): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 'ADMIN', 1, ?, ?)`,
    [id, "Repo Test Admin", `admin-${id}@example.com`, now, now],
  );
  return id;
}
