import { v4 as uuid } from "uuid";
import { LocationRepository, LocationFilters } from "../../domain/repositories/locationRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import {
  Location,
  LocationOrganizationMember,
  LocationStatus,
  LocationWithMembers,
  assertValidCoordinates,
} from "../../domain/entities/location";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertAdmin, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";

export interface OrganizationMemberInput {
  name: string;
  roleTitle: string;
  phone?: string | null;
}

export interface CreateLocationInput {
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  description?: string | null;
  organizationMembers?: OrganizationMemberInput[];
}

export interface UpdateLocationInput {
  name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  description?: string | null;
  status?: LocationStatus;
  organizationMembers?: OrganizationMemberInput[];
}

function validateName(name: string): void {
  if (name.length < 2 || name.length > 150) {
    throw AppError.validation("name must be between 2 and 150 characters.", {
      name: "Invalid length.",
    });
  }
}

export class LocationUseCases {
  constructor(
    private readonly locations: LocationRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async list(
    auth: AuthContext,
    filters: LocationFilters,
    page: PageRequest,
  ): Promise<ListResult<Location>> {
    const scoped = auth.role === "ADMIN" ? filters : { ...filters, ids: auth.assignedLocationIds };
    return this.locations.list(scoped, page);
  }

  async getById(auth: AuthContext, id: string): Promise<LocationWithMembers> {
    assertLocationScope(auth, id);
    const location = await this.locations.findById(id);
    if (!location || location.deletedAt) throw AppError.notFound("Location not found.");
    return location;
  }

  async create(auth: AuthContext, input: CreateLocationInput): Promise<Location> {
    assertAdmin(auth);
    validateName(input.name);
    assertValidCoordinates(input.latitude ?? null, input.longitude ?? null);

    const existing = await this.locations.findActiveByName(input.name);
    if (existing) {
      throw AppError.conflict("An active location with this name already exists.");
    }

    const now = this.clock.nowIso();
    const location: Location = {
      id: uuid(),
      name: input.name,
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone ?? null,
      description: input.description ?? null,
      coverPhotoObjectKey: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const members = (input.organizationMembers ?? []).map((member) =>
      toMember(location.id, member),
    );
    await this.locations.create(location, members);

    return location;
  }

  async update(
    auth: AuthContext,
    id: string,
    input: UpdateLocationInput,
  ): Promise<LocationWithMembers> {
    assertAdmin(auth);
    const existing = await this.locations.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Location not found.");

    if (input.name !== undefined) validateName(input.name);
    assertValidCoordinates(
      input.latitude !== undefined ? input.latitude : existing.latitude,
      input.longitude !== undefined ? input.longitude : existing.longitude,
    );

    if (input.name && input.name !== existing.name) {
      const duplicate = await this.locations.findActiveByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict("An active location with this name already exists.");
      }
    }

    const now = this.clock.nowIso();
    const patch: Partial<Location> = { updatedAt: now };
    if (input.name !== undefined) patch.name = input.name;
    if (input.address !== undefined) patch.address = input.address;
    if (input.latitude !== undefined) patch.latitude = input.latitude;
    if (input.longitude !== undefined) patch.longitude = input.longitude;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;

    await this.locations.update(id, patch);

    if (input.organizationMembers) {
      await this.locations.replaceMembers(
        id,
        input.organizationMembers.map((member) => toMember(id, member)),
      );
    }

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "location",
      resourceId: id,
      context: { operation: "update" },
      createdAt: now,
    });

    const updated = await this.locations.findById(id);
    return updated!;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    assertAdmin(auth);
    const existing = await this.locations.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Location not found.");

    await this.locations.softDelete(id);
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "DELETE",
      resourceType: "location",
      resourceId: id,
      context: null,
      createdAt: this.clock.nowIso(),
    });
  }
}

function toMember(locationId: string, input: OrganizationMemberInput): LocationOrganizationMember {
  return {
    id: uuid(),
    locationId,
    name: input.name,
    roleTitle: input.roleTitle,
    phone: input.phone ?? null,
  };
}
