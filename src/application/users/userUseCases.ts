import { v4 as uuid } from "uuid";
import { UserRepository, UserFilters } from "../../domain/repositories/userRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { PublicUser, User, UserRole, toPublicUser } from "../../domain/entities/user";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertAdmin } from "../authz/authContext";
import { PasswordHasher, Clock } from "../auth/ports";

export interface CreateUserInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  role: UserRole;
  locationIds?: string[];
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  role?: UserRole;
  locationIds?: string[];
}

export class UserUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async list(
    auth: AuthContext,
    filters: UserFilters,
    page: PageRequest,
  ): Promise<ListResult<PublicUser>> {
    assertAdmin(auth);
    const result = await this.users.list(filters, page);
    return { data: result.data.map(toPublicUser), meta: result.meta };
  }

  async getById(auth: AuthContext, id: string): Promise<PublicUser> {
    assertAdmin(auth);
    const user = await this.users.findById(id);
    if (!user || user.deletedAt) throw AppError.notFound("User not found.");
    return toPublicUser(user);
  }

  async create(auth: AuthContext, input: CreateUserInput): Promise<PublicUser> {
    assertAdmin(auth);

    if (!input.email && !input.phone) {
      throw AppError.validation("Either email or phone is required.", {
        email: "Provide email or phone.",
      });
    }

    const now = this.clock.nowIso();
    const user: User = {
      id: uuid(),
      fullName: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: await this.passwordHasher.hash(input.password),
      role: input.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.users.create(user);

    if (input.role === "LOCATION_OPERATOR" && input.locationIds?.length) {
      await this.users.assignLocations(user.id, input.locationIds);
    }

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "PERMISSION_CHANGE",
      resourceType: "user",
      resourceId: user.id,
      context: { operation: "create", role: user.role },
      createdAt: now,
    });

    return toPublicUser(user);
  }

  async update(auth: AuthContext, id: string, input: UpdateUserInput): Promise<PublicUser> {
    assertAdmin(auth);
    const existing = await this.users.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("User not found.");

    const now = this.clock.nowIso();
    const patch: Partial<User> = { updatedAt: now };
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.role !== undefined) patch.role = input.role;

    await this.users.update(id, patch);

    if (input.locationIds) {
      await this.users.assignLocations(id, input.locationIds);
    }

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "PERMISSION_CHANGE",
      resourceType: "user",
      resourceId: id,
      context: { operation: "update" },
      createdAt: now,
    });

    const updated = await this.users.findById(id);
    return toPublicUser(updated!);
  }

  async deactivate(auth: AuthContext, id: string): Promise<void> {
    assertAdmin(auth);
    const existing = await this.users.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("User not found.");

    const now = this.clock.nowIso();
    await this.users.update(id, { isActive: false, updatedAt: now });

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "PERMISSION_CHANGE",
      resourceType: "user",
      resourceId: id,
      context: { operation: "deactivate" },
      createdAt: now,
    });
  }
}
