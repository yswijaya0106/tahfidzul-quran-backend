import { describe, expect, it } from "vitest";
import { UserUseCases } from "../../src/application/users/userUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { User } from "../../src/domain/entities/user";

class FakeUserRepository {
  users: User[] = [];
  assignments = new Map<string, string[]>();
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmailOrPhone() {
    return null;
  }
  async list() {
    return { data: this.users, meta: { page: 1, pageSize: 20, total: this.users.length } };
  }
  async create(user: User) {
    this.users.push(user);
  }
  async update(id: string, patch: Partial<User>) {
    const index = this.users.findIndex((u) => u.id === id);
    this.users[index] = { ...this.users[index]!, ...patch };
  }
  async getAssignedLocationIds(id: string) {
    return this.assignments.get(id) ?? [];
  }
  async assignLocations(id: string, locationIds: string[]) {
    this.assignments.set(id, locationIds);
  }
  async listAssignments() {
    return [];
  }
}

class FakeLocationRepository {
  private readonly knownIds = new Set(["loc-1", "loc-2"]);
  async findById(id: string) {
    if (!this.knownIds.has(id)) return null;
    return { id, deletedAt: null } as never;
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

class FakePasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify() {
    return true;
  }
}

function buildUseCase() {
  const users = new FakeUserRepository();
  const locations = new FakeLocationRepository();
  const auditLogs = new FakeAuditLogRepository();
  const useCase = new UserUseCases(
    users as never,
    locations as never,
    auditLogs as never,
    new FakePasswordHasher(),
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
  );
  return { useCase, users, auditLogs };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: [],
};

function makeUser(id: string): User {
  return {
    id,
    fullName: "Test User",
    email: "user@example.com",
    phone: null,
    passwordHash: "hash",
    role: "LOCATION_OPERATOR",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("UserUseCases", () => {
  it("rejects list, getById, create, update, deactivate for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.list(operator, {}, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      status: 403,
    });
    await expect(useCase.getById(operator, "x")).rejects.toMatchObject({ status: 403 });
    await expect(
      useCase.create(operator, {
        fullName: "X",
        email: "x@example.com",
        password: "pw",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(useCase.update(operator, "x", { fullName: "Y" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(useCase.deactivate(operator, "x")).rejects.toMatchObject({ status: 403 });
  });

  it("lists users without exposing password hashes", async () => {
    const { useCase, users } = buildUseCase();
    users.users.push(makeUser("u1"));
    const result = await useCase.list(admin, {}, { page: 1, pageSize: 20 });
    expect(result.data[0]).not.toHaveProperty("passwordHash");
  });

  it("throws not found for a missing or deleted user", async () => {
    const { useCase, users } = buildUseCase();
    await expect(useCase.getById(admin, "missing")).rejects.toMatchObject({ status: 404 });

    users.users.push({ ...makeUser("u2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.getById(admin, "u2")).rejects.toMatchObject({ status: 404 });
  });

  it("creates a user and assigns locations for a LOCATION_OPERATOR", async () => {
    const { useCase, users, auditLogs } = buildUseCase();
    const created = await useCase.create(admin, {
      fullName: "New Operator",
      email: "new@example.com",
      password: "StrongPassw0rd!",
      role: "LOCATION_OPERATOR",
      locationIds: ["loc-1"],
    });
    expect(created.fullName).toBe("New Operator");
    expect(users.assignments.get(created.id)).toEqual(["loc-1"]);
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("creates an ADMIN without assigning locations even if provided", async () => {
    const { useCase, users } = buildUseCase();
    const created = await useCase.create(admin, {
      fullName: "New Admin",
      phone: "0800",
      password: "StrongPassw0rd!",
      role: "ADMIN",
      locationIds: ["loc-1"],
    });
    expect(users.assignments.has(created.id)).toBe(false);
  });

  it("rejects create without email or phone", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, { fullName: "X", password: "pw", role: "ADMIN" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects creating a LOCATION_OPERATOR without any locationIds", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        fullName: "No Location",
        email: "no-location@example.com",
        password: "StrongPassw0rd!",
        role: "LOCATION_OPERATOR",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects creating a LOCATION_OPERATOR with an unknown locationId", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.create(admin, {
        fullName: "Bad Location",
        email: "bad-location@example.com",
        password: "StrongPassw0rd!",
        role: "LOCATION_OPERATOR",
        locationIds: ["does-not-exist"],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects changing a user to LOCATION_OPERATOR without assigning locations", async () => {
    const { useCase, users } = buildUseCase();
    users.users.push({ ...makeUser("u1"), role: "ADMIN" });
    await expect(useCase.update(admin, "u1", { role: "LOCATION_OPERATOR" })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("rejects clearing locationIds on an existing LOCATION_OPERATOR", async () => {
    const { useCase, users } = buildUseCase();
    users.users.push(makeUser("u1"));
    users.assignments.set("u1", ["loc-1"]);
    await expect(useCase.update(admin, "u1", { locationIds: [] })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("updates a user and reassigns locations when provided", async () => {
    const { useCase, users, auditLogs } = buildUseCase();
    users.users.push(makeUser("u1"));
    const updated = await useCase.update(admin, "u1", {
      fullName: "Renamed",
      email: "renamed@example.com",
      phone: "0800",
      role: "ADMIN",
      locationIds: ["loc-2"],
    });
    expect(updated.fullName).toBe("Renamed");
    expect(updated.email).toBe("renamed@example.com");
    expect(updated.phone).toBe("0800");
    expect(updated.role).toBe("ADMIN");
    expect(users.assignments.get("u1")).toEqual(["loc-2"]);
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects update for a missing or deleted user", async () => {
    const { useCase, users } = buildUseCase();
    await expect(useCase.update(admin, "missing", { fullName: "X" })).rejects.toMatchObject({
      status: 404,
    });

    users.users.push({ ...makeUser("u2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.update(admin, "u2", { fullName: "X" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deactivates a user and records an audit log", async () => {
    const { useCase, users, auditLogs } = buildUseCase();
    users.users.push(makeUser("u1"));
    await useCase.deactivate(admin, "u1");
    expect(users.users[0]!.isActive).toBe(false);
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("rejects deactivate for a missing or deleted user", async () => {
    const { useCase, users } = buildUseCase();
    await expect(useCase.deactivate(admin, "missing")).rejects.toMatchObject({ status: 404 });

    users.users.push({ ...makeUser("u2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(useCase.deactivate(admin, "u2")).rejects.toMatchObject({ status: 404 });
  });
});
