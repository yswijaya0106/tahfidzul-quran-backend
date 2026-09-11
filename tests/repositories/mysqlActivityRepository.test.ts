import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";
import { createPool, Pool } from "../../src/infrastructure/db/pool";
import { MysqlActivityRepository } from "../../src/infrastructure/repositories/mysqlActivityRepository";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { Activity, ActivityPhoto } from "../../src/domain/entities/activity";

let pool: Pool;
let repo: MysqlActivityRepository;
let locationId: string;
let userId: string;

beforeAll(async () => {
  await runMigrations();
  pool = createPool();
  repo = new MysqlActivityRepository(pool);
  locationId = await createLocation(pool);
  userId = await createUser(pool);
});

afterAll(async () => {
  await pool.end();
});

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    locationId,
    title: "Repo Test Activity",
    description: null,
    activityDate: "2026-01-15",
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makePhoto(activityId: string, overrides: Partial<ActivityPhoto> = {}): ActivityPhoto {
  return {
    id: uuid(),
    activityId,
    objectKey: `objects/${uuid()}.jpg`,
    caption: null,
    displayOrder: 1,
    thumbnailObjectKey: null,
    processingStatus: "PENDING",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

describe("MysqlActivityRepository", () => {
  it("creates an activity with photos and finds it by id", async () => {
    const activity = makeActivity();
    await repo.create(activity, [makePhoto(activity.id)]);

    const found = await repo.findById(activity.id);
    expect(found?.title).toBe(activity.title);
    expect(await repo.listPhotos(activity.id)).toHaveLength(1);
  });

  it("returns null for a missing id", async () => {
    expect(await repo.findById(uuid())).toBeNull();
  });

  it("lists activities filtered by locationId and date range", async () => {
    const activity = makeActivity({ activityDate: "2026-02-01" });
    await repo.create(activity, []);

    const byLocation = await repo.list({ locationId }, { page: 1, pageSize: 50 });
    expect(byLocation.data.some((a) => a.id === activity.id)).toBe(true);

    const inRange = await repo.list(
      { locationId, dateFrom: "2026-01-01", dateTo: "2026-03-01" },
      { page: 1, pageSize: 50 },
    );
    expect(inRange.data.some((a) => a.id === activity.id)).toBe(true);

    const outOfRange = await repo.list(
      { locationId, dateFrom: "2020-01-01", dateTo: "2020-01-02" },
      { page: 1, pageSize: 50 },
    );
    expect(outOfRange.data.some((a) => a.id === activity.id)).toBe(false);
  });

  it("updates activity fields including clearing deletedAt", async () => {
    const activity = makeActivity();
    await repo.create(activity, []);

    await repo.update(activity.id, {
      title: "Renamed",
      description: "desc",
      activityDate: "2026-03-01",
      deletedAt: new Date().toISOString(),
    });
    let found = await repo.findById(activity.id);
    expect(found?.title).toBe("Renamed");
    expect(found?.deletedAt).not.toBeNull();

    await repo.update(activity.id, { deletedAt: null });
    found = await repo.findById(activity.id);
    expect(found?.deletedAt).toBeNull();
  });

  it("does nothing when the update patch is empty", async () => {
    const activity = makeActivity();
    await repo.create(activity, []);
    await expect(repo.update(activity.id, {})).resolves.toBeUndefined();
  });

  it("archives an activity", async () => {
    const activity = makeActivity();
    await repo.create(activity, []);
    await repo.archive(activity.id);

    const found = await repo.findById(activity.id);
    expect(found?.deletedAt).not.toBeNull();
  });

  it("replaces photos for an activity", async () => {
    const activity = makeActivity();
    await repo.create(activity, [makePhoto(activity.id, { caption: "Old" })]);

    await repo.replacePhotos(activity.id, [makePhoto(activity.id, { caption: "New" })]);

    const photos = await repo.listPhotos(activity.id);
    expect(photos).toHaveLength(1);
    expect(photos[0]!.caption).toBe("New");
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
