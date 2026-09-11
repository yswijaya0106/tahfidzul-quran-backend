import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlIkhtibarRepository } from "../../src/infrastructure/repositories/mysqlIkhtibarRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { Ikhtibar } from "../../src/domain/entities/ikhtibar";

let pool: Pool;
let repo: MysqlIkhtibarRepository;
let locationId: string;
let studentId: string;
let userId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlIkhtibarRepository(pool);
  locationId = await createLocation(pool);
  userId = await createUser(pool);
  studentId = await createStudent(pool, locationId);
});

afterAll(async () => {
  await pool.end();
});

function makeIkhtibar(overrides: Partial<Ikhtibar> = {}): Ikhtibar {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    studentId,
    locationId,
    examDate: "2026-01-10T00:00:00.000Z",
    juzFrom: 1,
    juzTo: 3,
    grade: "MUMTAZ",
    score: 90,
    notes: null,
    assessorUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlIkhtibarRepository", () => {
  it("creates an ikhtibar and finds it by id (examDate normalized to date-only)", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);

    const found = await repo.findById(ikhtibar.id);
    expect(found?.examDate).toBe("2026-01-10");
    expect(found?.score).toBe(90);
    expect(found?.grade).toBe("MUMTAZ");
  });

  it("returns null for a missing id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("lists ikhtibar records filtered by studentId, locationId, locationIds, and date range", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);

    expect(
      (await repo.list({ studentId }, { page: 1, pageSize: 50 })).data.some(
        (i) => i.id === ikhtibar.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationId }, { page: 1, pageSize: 50 })).data.some(
        (i) => i.id === ikhtibar.id,
      ),
    ).toBe(true);
    expect(
      (await repo.list({ locationIds: [locationId] }, { page: 1, pageSize: 50 })).data.some(
        (i) => i.id === ikhtibar.id,
      ),
    ).toBe(true);
    expect(await repo.list({ locationIds: [] }, { page: 1, pageSize: 50 })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
    expect(
      (
        await repo.list({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }, { page: 1, pageSize: 50 })
      ).data.some((i) => i.id === ikhtibar.id),
    ).toBe(true);
    expect(
      (
        await repo.list({ dateFrom: "2020-01-01", dateTo: "2020-01-02" }, { page: 1, pageSize: 50 })
      ).data.some((i) => i.id === ikhtibar.id),
    ).toBe(false);
  });

  it("updates ikhtibar fields including clearing deletedAt", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);

    await repo.update(ikhtibar.id, {
      examDate: "2026-02-01T00:00:00.000Z",
      juzFrom: 5,
      juzTo: 10,
      grade: "JAYYID",
      score: 65,
      notes: "note",
      deletedAt: new Date().toISOString(),
    });

    let found = await repo.findById(ikhtibar.id);
    expect(found?.examDate).toBe("2026-02-01");
    expect(found?.grade).toBe("JAYYID");
    expect(found?.deletedAt).not.toBeNull();

    await repo.update(ikhtibar.id, { deletedAt: null });
    found = await repo.findById(ikhtibar.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("does nothing when the update patch is empty", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);
    await expect(repo.update(ikhtibar.id, {})).resolves.toBeUndefined();
  });

  it("archives an ikhtibar", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);
    await repo.archive(ikhtibar.id);

    const found = await repo.findById(ikhtibar.id);
    expect(found?.deletedAt).not.toBeNull();
  });

  it("adds and lists revisions for an ikhtibar", async () => {
    const ikhtibar = makeIkhtibar();
    await repo.create(ikhtibar);

    await repo.addRevision({
      id: uuid(),
      ikhtibarId: ikhtibar.id,
      changedByUserId: userId,
      changeType: "CREATE",
      previousValue: null,
      newValue: { grade: "MUMTAZ" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await repo.addRevision({
      id: uuid(),
      ikhtibarId: ikhtibar.id,
      changedByUserId: userId,
      changeType: "UPDATE",
      previousValue: { grade: "MUMTAZ" },
      newValue: { grade: "JAYYID" },
      createdAt: "2026-01-01T00:00:05.000Z",
    });

    const revisions = await repo.listRevisions(ikhtibar.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["CREATE", "UPDATE"]);
    expect(revisions[1]!.previousValue).toEqual({ grade: "MUMTAZ" });
  });
});

async function createLocation(pool: Pool): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO locations (id, name, address, status, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, `Location ${id.slice(0, 8)}`, "Street", now, now],
  );
  return id;
}

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

async function createStudent(pool: Pool, locationId: string): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    `INSERT INTO students (id, student_code, full_name, location_id, status, created_at, updated_at)
     VALUES (?, ?, 'Repo Test Student', ?, 'ACTIVE', ?, ?)`,
    [id, `TQ-${id.slice(0, 8)}`, locationId, now, now],
  );
  return id;
}
