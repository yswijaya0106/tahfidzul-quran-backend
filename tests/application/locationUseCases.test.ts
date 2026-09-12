import { describe, expect, it } from "vitest";
import { LocationUseCases } from "../../src/application/locations/locationUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { AppError } from "../../src/domain/errors";
import { Location, LocationWithMembers } from "../../src/domain/entities/location";

class FakeLocationRepository {
  locations: Location[] = [];
  members = new Map<string, unknown[]>();

  async findById(id: string): Promise<LocationWithMembers | null> {
    const location = this.locations.find((l) => l.id === id);
    if (!location) return null;
    return { ...location, organizationMembers: (this.members.get(id) ?? []) as never[] };
  }
  async findActiveByName(name: string) {
    return this.locations.find((l) => l.name === name && l.status === "ACTIVE") ?? null;
  }
  async list(_filters?: unknown) {
    return { data: this.locations, meta: { page: 1, pageSize: 20, total: this.locations.length } };
  }
  async create(location: Location, members: unknown[]) {
    this.locations.push(location);
    this.members.set(location.id, members);
  }
  async update(id: string, patch: Partial<Location>) {
    const index = this.locations.findIndex((l) => l.id === id);
    this.locations[index] = { ...this.locations[index]!, ...patch };
  }
  async replaceMembers(id: string, members: unknown[]) {
    this.members.set(id, members);
  }
  async softDelete(id: string) {
    const index = this.locations.findIndex((l) => l.id === id);
    this.locations[index] = { ...this.locations[index]!, deletedAt: "2026-01-02T00:00:00.000Z" };
  }
}

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

function buildUseCase() {
  const locations = new FakeLocationRepository();
  const auditLogs = new FakeAuditLogRepository();
  const useCase = new LocationUseCases(locations as never, auditLogs as never, {
    nowIso: () => "2026-01-01T00:00:00.000Z",
  });
  return { useCase, locations, auditLogs };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-1"],
};

describe("LocationUseCases", () => {
  it("scopes list() to assigned locations for an operator", async () => {
    const { useCase, locations } = buildUseCase();
    let capturedFilters: unknown;
    locations.list = async (filters: unknown) => {
      capturedFilters = filters;
      return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
    };
    await useCase.list(operator, {}, { page: 1, pageSize: 20 });
    expect(capturedFilters).toMatchObject({ ids: ["location-1"] });
  });

  it("does not scope list() for an admin", async () => {
    const { useCase, locations } = buildUseCase();
    let capturedFilters: unknown;
    locations.list = async (filters: unknown) => {
      capturedFilters = filters;
      return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
    };
    await useCase.list(admin, { status: "ACTIVE" }, { page: 1, pageSize: 20 });
    expect(capturedFilters).toEqual({ status: "ACTIVE" });
  });

  it("rejects getById for an operator outside the location scope", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(makeLocation("loc-1"));
    await expect(useCase.getById(operator, "loc-1")).rejects.toMatchObject({ status: 403 });
  });

  it("throws not found for a missing or deleted location", async () => {
    const { useCase, locations } = buildUseCase();
    await expect(useCase.getById(admin, "missing")).rejects.toMatchObject({ status: 404 });

    locations.locations.push({ ...makeLocation("loc-2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.getById(admin, "loc-2")).rejects.toMatchObject({ status: 404 });
  });

  it("creates a location as admin", async () => {
    const { useCase } = buildUseCase();
    const created = await useCase.create(admin, {
      name: "Location A",
      address: "Street 1",
      latitude: 1,
      longitude: 2,
      organizationMembers: [{ name: "Member", roleTitle: "Ustadz" }],
    });
    expect(created.name).toBe("Location A");
    expect(created.status).toBe("ACTIVE");
  });

  it("rejects create for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(operator, { name: "Location A", address: "Street 1" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects create with an invalid name length", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.create(admin, { name: "A", address: "Street" })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("rejects create with invalid coordinates", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, { name: "Location B", address: "Street", latitude: 999 }),
    ).rejects.toThrow();
  });

  it("rejects create when an active location with the same name exists", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(makeLocation("loc-1", "Duplicate"));
    await expect(
      useCase.create(admin, { name: "Duplicate", address: "Street" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("updates a location and records an audit log", async () => {
    const { useCase, locations, auditLogs } = buildUseCase();
    locations.locations.push(makeLocation("loc-1", "Original"));

    const updated = await useCase.update(admin, "loc-1", {
      name: "Renamed",
      status: "INACTIVE",
      address: "New street",
      latitude: 1,
      longitude: 2,
      phone: "0800",
      description: "New description",
      organizationMembers: [{ name: "New Member", roleTitle: "Admin", phone: "0800" }],
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.status).toBe("INACTIVE");
    expect(updated.address).toBe("New street");
    expect(updated.latitude).toBe(1);
    expect(updated.longitude).toBe(2);
    expect(updated.phone).toBe("0800");
    expect(updated.description).toBe("New description");
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects update for a missing location", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.update(admin, "missing", { name: "X" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects update when renaming to a name used by another active location", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(makeLocation("loc-1", "First"));
    locations.locations.push(makeLocation("loc-2", "Second"));

    await expect(useCase.update(admin, "loc-2", { name: "First" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("allows renaming to the same name without conflict", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(makeLocation("loc-1", "First"));
    const updated = await useCase.update(admin, "loc-1", { name: "First" });
    expect(updated.name).toBe("First");
  });

  it("rejects update with invalid coordinates carried from existing values", async () => {
    const { useCase, locations } = buildUseCase();
    locations.locations.push(makeLocation("loc-1"));
    await expect(useCase.update(admin, "loc-1", { latitude: 200 })).rejects.toThrow();
  });

  it("removes a location and records an audit log", async () => {
    const { useCase, locations, auditLogs } = buildUseCase();
    locations.locations.push(makeLocation("loc-1"));
    await useCase.remove(admin, "loc-1");
    expect(locations.locations[0]!.deletedAt).not.toBeNull();
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects remove for a missing location", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.remove(admin, "missing")).rejects.toMatchObject({ status: 404 });
  });
});

function makeLocation(id: string, name = "Location"): Location {
  return {
    id,
    name,
    address: "Street",
    provinsi: null,
    kabKota: null,
    kecamatan: null,
    kodePos: null,
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
}
