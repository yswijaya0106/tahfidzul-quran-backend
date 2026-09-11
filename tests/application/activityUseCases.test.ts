import { describe, expect, it } from "vitest";
import { ActivityUseCases } from "../../src/application/activities/activityUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { Activity, ActivityPhoto } from "../../src/domain/entities/activity";
import { Location } from "../../src/domain/entities/location";

class FakeActivityRepository {
  activities: Activity[] = [];
  photos = new Map<string, ActivityPhoto[]>();
  async findById(id: string) {
    return this.activities.find((a) => a.id === id) ?? null;
  }
  async list() {
    return {
      data: this.activities,
      meta: { page: 1, pageSize: 20, total: this.activities.length },
    };
  }
  async create(activity: Activity, photos: ActivityPhoto[]) {
    this.activities.push(activity);
    this.photos.set(activity.id, photos);
  }
  async update(id: string, patch: Partial<Activity>) {
    const index = this.activities.findIndex((a) => a.id === id);
    this.activities[index] = { ...this.activities[index]!, ...patch };
  }
  async archive(id: string) {
    const index = this.activities.findIndex((a) => a.id === id);
    this.activities[index] = { ...this.activities[index]!, deletedAt: "2026-01-02T00:00:00.000Z" };
  }
  async replacePhotos(id: string, photos: ActivityPhoto[]) {
    this.photos.set(id, photos);
  }
  async listPhotos(id: string) {
    return this.photos.get(id) ?? [];
  }
}

class FakeLocationRepository {
  locations: Location[] = [];
  async findById(id: string) {
    return this.locations.find((l) => l.id === id) ?? null;
  }
  async findActiveByName() {
    return null;
  }
  async list() {
    return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  }
  async create() {}
  async update() {}
  async replaceMembers() {}
  async softDelete() {}
}

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

function buildUseCase() {
  const activities = new FakeActivityRepository();
  const locations = new FakeLocationRepository();
  const auditLogs = new FakeAuditLogRepository();
  const useCase = new ActivityUseCases(
    activities as never,
    locations as never,
    auditLogs as never,
    {
      nowIso: () => "2026-01-01T00:00:00.000Z",
    },
  );
  return { useCase, activities, locations, auditLogs };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

const activeLocation: Location = {
  id: "location-a",
  name: "Location A",
  address: "Street",
  latitude: null,
  longitude: null,
  phone: null,
  description: null,
  coverPhotoObjectKey: null,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

function makeActivity(id: string, locationId = "location-a"): Activity {
  return {
    id,
    locationId,
    title: "Activity",
    description: null,
    activityDate: "2026-01-01",
    createdByUserId: "admin-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

const photo = {
  objectKey: "photo-1",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  displayOrder: 1,
};

describe("ActivityUseCases", () => {
  it("rejects listForLocation for an operator outside the location scope", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.listForLocation(operator, "location-b", {}, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows listForLocation for an operator assigned to the location", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.listForLocation(
      operator,
      "location-a",
      {},
      {
        page: 1,
        pageSize: 20,
      },
    );
    expect(result.data).toEqual([]);
  });

  it("throws not found for a missing or deleted activity", async () => {
    const { useCase, activities } = buildUseCase();
    await expect(useCase.getById(admin, "missing")).rejects.toMatchObject({ status: 404 });

    activities.activities.push({ ...makeActivity("a2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.getById(admin, "a2")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects getById for an operator outside the location scope", async () => {
    const { useCase, activities } = buildUseCase();
    activities.activities.push(makeActivity("a1", "location-b"));
    await expect(useCase.getById(operator, "a1")).rejects.toMatchObject({ status: 403 });
  });

  it("creates an activity with photos", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      locationId: "location-a",
      title: "New Activity",
      activityDate: "2026-01-01",
      photos: [photo],
    });
    expect(created.title).toBe("New Activity");
  });

  it("rejects create for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(operator, {
        locationId: "location-a",
        title: "X",
        activityDate: "2026-01-01",
        photos: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects create with an unsupported photo MIME type", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await expect(
      useCase.create(admin, {
        locationId: "location-a",
        title: "X",
        activityDate: "2026-01-01",
        photos: [{ ...photo, mimeType: "application/zip" }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects create with an oversized photo", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await expect(
      useCase.create(admin, {
        locationId: "location-a",
        title: "X",
        activityDate: "2026-01-01",
        photos: [{ ...photo, sizeBytes: 999_999_999 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects create when the location is missing or deleted", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        locationId: "missing",
        title: "X",
        activityDate: "2026-01-01",
        photos: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("updates an activity, replaces photos, and records an audit log", async () => {
    const { useCase, activities, auditLogs } = buildUseCase();
    activities.activities.push(makeActivity("a1"));

    const updated = await useCase.update(admin, "a1", {
      title: "Renamed",
      description: "New description",
      activityDate: "2026-03-15",
      photos: [photo],
    });

    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("New description");
    expect(updated.activityDate).toBe("2026-03-15");
    expect(await activities.listPhotos("a1")).toHaveLength(1);
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects update for a missing or deleted activity", async () => {
    const { useCase, activities } = buildUseCase();
    await expect(useCase.update(admin, "missing", { title: "X" })).rejects.toMatchObject({
      status: 404,
    });

    activities.activities.push({ ...makeActivity("a2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.update(admin, "a2", { title: "X" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects update with invalid photos", async () => {
    const { useCase, activities } = buildUseCase();
    activities.activities.push(makeActivity("a1"));
    await expect(
      useCase.update(admin, "a1", { photos: [{ ...photo, mimeType: "text/plain" }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("archives an activity and records an audit log", async () => {
    const { useCase, activities, auditLogs } = buildUseCase();
    activities.activities.push(makeActivity("a1"));
    await useCase.archive(admin, "a1");
    expect(activities.activities[0]!.deletedAt).not.toBeNull();
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects archive for a missing or already-deleted activity", async () => {
    const { useCase, activities } = buildUseCase();
    await expect(useCase.archive(admin, "missing")).rejects.toMatchObject({ status: 404 });

    activities.activities.push({ ...makeActivity("a2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.archive(admin, "a2")).rejects.toMatchObject({ status: 404 });
  });
});
