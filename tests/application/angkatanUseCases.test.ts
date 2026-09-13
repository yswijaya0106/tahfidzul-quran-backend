import { describe, expect, it } from "vitest";
import { AngkatanUseCases } from "../../src/application/angkatan/angkatanUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { Angkatan } from "../../src/domain/entities/angkatan";
import { Location } from "../../src/domain/entities/location";

class FakeAngkatanRepository {
  rows: Angkatan[] = [];
  async findById(id: string) {
    return this.rows.find((a) => a.id === id) ?? null;
  }
  async findActiveByName(locationId: string, name: string) {
    return (
      this.rows.find((a) => a.locationId === locationId && a.name === name && !a.deletedAt) ?? null
    );
  }
  async list(filters: { locationId?: string; locationIds?: string[] }) {
    if (filters.locationIds && filters.locationIds.length === 0) {
      return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
    }
    let data = this.rows.filter((a) => !a.deletedAt);
    if (filters.locationId) data = data.filter((a) => a.locationId === filters.locationId);
    if (filters.locationIds) data = data.filter((a) => filters.locationIds!.includes(a.locationId));
    return { data, meta: { page: 1, pageSize: 20, total: data.length } };
  }
  async create(angkatan: Angkatan) {
    this.rows.push(angkatan);
  }
  async update(id: string, patch: Partial<Angkatan>) {
    const index = this.rows.findIndex((a) => a.id === id);
    this.rows[index] = { ...this.rows[index]!, ...patch };
  }
  async softDelete(id: string) {
    const index = this.rows.findIndex((a) => a.id === id);
    this.rows[index] = { ...this.rows[index]!, deletedAt: "2026-01-02T00:00:00.000Z" };
  }
  async hasStudents() {
    return false;
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
  const angkatan = new FakeAngkatanRepository();
  const locations = new FakeLocationRepository();
  const auditLogs = new FakeAuditLogRepository();
  const useCase = new AngkatanUseCases(angkatan as never, locations as never, auditLogs as never, {
    nowIso: () => "2026-01-01T00:00:00.000Z",
  });
  return { useCase, angkatan, locations, auditLogs };
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
  provinsi: null,
  kabKota: null,
  kecamatan: null,
  kodePos: null,
  provinceId: null,
  cityId: null,
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

describe("AngkatanUseCases", () => {
  it("creates an angkatan as admin", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);

    const created = await useCase.create(admin, {
      locationId: "location-a",
      name: "Angkatan 2024",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(created.locationId).toBe("location-a");
  });

  it("rejects create for a non-admin", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await expect(
      useCase.create(operator, {
        locationId: "location-a",
        name: "X",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects create when the location is missing", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        locationId: "missing",
        name: "X",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an endDate before startDate", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await expect(
      useCase.create(admin, {
        locationId: "location-a",
        name: "X",
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a duplicate active name at the same location", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(activeLocation);
    await useCase.create(admin, {
      locationId: "location-a",
      name: "Dup",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    await expect(
      useCase.create(admin, {
        locationId: "location-a",
        name: "Dup",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("allows an operator to list angkatan for their assigned location only", async () => {
    const { useCase, angkatan } = buildUseCase();
    angkatan.rows.push({
      id: "a1",
      locationId: "location-a",
      name: "A",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    });
    angkatan.rows.push({
      id: "a2",
      locationId: "location-b",
      name: "B",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    });

    const result = await useCase.list(operator, {}, { page: 1, pageSize: 20 });
    expect(result.data.map((a) => a.id)).toEqual(["a1"]);
  });

  it("rejects listForLocation for an operator outside the location scope", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.listForLocation(operator, "location-b", {}, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects getById for an operator outside the location scope", async () => {
    const { useCase, angkatan } = buildUseCase();
    angkatan.rows.push({
      id: "a1",
      locationId: "location-b",
      name: "A",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    });
    await expect(useCase.getById(operator, "a1")).rejects.toMatchObject({ status: 403 });
  });

  it("updates an angkatan and records an audit log", async () => {
    const { useCase, locations, auditLogs } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      locationId: "location-a",
      name: "Original",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    const updated = await useCase.update(admin, created.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects update for a missing angkatan", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.update(admin, "missing", { name: "X" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("removes an angkatan with no students, and records an audit log", async () => {
    const { useCase, locations, auditLogs } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      locationId: "location-a",
      name: "Removable",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    await useCase.remove(admin, created.id);
    expect(auditLogs.entries).toHaveLength(1);
    await expect(useCase.getById(admin, created.id)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects removing an angkatan that still has students", async () => {
    const { useCase, locations, angkatan } = buildUseCase();
    locations.locations.push(activeLocation);
    const created = await useCase.create(admin, {
      locationId: "location-a",
      name: "Has Students",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    angkatan.hasStudents = async () => true;

    await expect(useCase.remove(admin, created.id)).rejects.toMatchObject({ status: 409 });
  });
});
