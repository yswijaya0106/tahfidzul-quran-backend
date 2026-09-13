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
import { ObjectStorage } from "../files/ports";

export interface OrganizationMemberInput {
  name: string;
  roleTitle: string;
  phone?: string | null;
}

export interface CreateLocationInput {
  name: string;
  address: string;
  provinsi?: string | null;
  kabKota?: string | null;
  kecamatan?: string | null;
  kodePos?: string | null;
  provinceId?: number | null;
  cityId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  description?: string | null;
  coverPhotoObjectKey?: string | null;
  organizationMembers?: OrganizationMemberInput[];
}

export interface UpdateLocationInput {
  name?: string;
  address?: string;
  provinsi?: string | null;
  kabKota?: string | null;
  kecamatan?: string | null;
  kodePos?: string | null;
  provinceId?: number | null;
  cityId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  description?: string | null;
  coverPhotoObjectKey?: string | null;
  status?: LocationStatus;
  organizationMembers?: OrganizationMemberInput[];
}

export type PublicLocation = Location & { coverPhotoUrl: string | null };
export type PublicLocationWithMembers = LocationWithMembers & { coverPhotoUrl: string | null };

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
    private readonly objectStorage: ObjectStorage,
  ) {}

  private async toPublic<T extends Location>(
    location: T,
  ): Promise<T & { coverPhotoUrl: string | null }> {
    const coverPhotoUrl = location.coverPhotoObjectKey
      ? await this.objectStorage.createSignedDownloadUrl(location.coverPhotoObjectKey)
      : null;
    return { ...location, coverPhotoUrl };
  }

  async list(
    auth: AuthContext,
    filters: LocationFilters,
    page: PageRequest,
  ): Promise<ListResult<PublicLocation>> {
    const scoped = auth.role === "ADMIN" ? filters : { ...filters, ids: auth.assignedLocationIds };
    const result = await this.locations.list(scoped, page);
    return {
      data: await Promise.all(result.data.map((location) => this.toPublic(location))),
      meta: result.meta,
    };
  }

  async getById(auth: AuthContext, id: string): Promise<PublicLocationWithMembers> {
    assertLocationScope(auth, id);
    const location = await this.locations.findById(id);
    if (!location || location.deletedAt) throw AppError.notFound("Location not found.");
    return this.toPublic(location);
  }

  async create(auth: AuthContext, input: CreateLocationInput): Promise<PublicLocation> {
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
      provinsi: input.provinsi ?? null,
      kabKota: input.kabKota ?? null,
      kecamatan: input.kecamatan ?? null,
      kodePos: input.kodePos ?? null,
      provinceId: input.provinceId ?? null,
      cityId: input.cityId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone ?? null,
      description: input.description ?? null,
      coverPhotoObjectKey: input.coverPhotoObjectKey ?? null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const members = (input.organizationMembers ?? []).map((member) =>
      toMember(location.id, member),
    );
    await this.locations.create(location, members);

    return this.toPublic(location);
  }

  async update(
    auth: AuthContext,
    id: string,
    input: UpdateLocationInput,
  ): Promise<PublicLocationWithMembers> {
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
    if (input.provinsi !== undefined) patch.provinsi = input.provinsi;
    if (input.kabKota !== undefined) patch.kabKota = input.kabKota;
    if (input.kecamatan !== undefined) patch.kecamatan = input.kecamatan;
    if (input.kodePos !== undefined) patch.kodePos = input.kodePos;
    if (input.provinceId !== undefined) patch.provinceId = input.provinceId;
    if (input.cityId !== undefined) patch.cityId = input.cityId;
    if (input.latitude !== undefined) patch.latitude = input.latitude;
    if (input.longitude !== undefined) patch.longitude = input.longitude;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.description !== undefined) patch.description = input.description;
    if (input.coverPhotoObjectKey !== undefined)
      patch.coverPhotoObjectKey = input.coverPhotoObjectKey;
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
    return this.toPublic(updated!);
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
