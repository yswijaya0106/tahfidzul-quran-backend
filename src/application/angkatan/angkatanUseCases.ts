import { v4 as uuid } from "uuid";
import { AngkatanRepository, AngkatanFilters } from "../../domain/repositories/angkatanRepository";
import { LocationRepository } from "../../domain/repositories/locationRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { Angkatan } from "../../domain/entities/angkatan";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertAdmin, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";

export interface CreateAngkatanInput {
  locationId: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdateAngkatanInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

function validateName(name: string): void {
  if (name.length < 2 || name.length > 100) {
    throw AppError.validation("name must be between 2 and 100 characters.", {
      name: "Invalid length.",
    });
  }
}

function validateDateRange(startDate: string, endDate: string): void {
  if (new Date(endDate) < new Date(startDate)) {
    throw AppError.validation("endDate must be on or after startDate.", {
      endDate: "Must not be before startDate.",
    });
  }
}

export class AngkatanUseCases {
  constructor(
    private readonly angkatan: AngkatanRepository,
    private readonly locations: LocationRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async list(
    auth: AuthContext,
    filters: AngkatanFilters,
    page: PageRequest,
  ): Promise<ListResult<Angkatan>> {
    const scoped =
      auth.role === "ADMIN" ? filters : { ...filters, locationIds: auth.assignedLocationIds };
    return this.angkatan.list(scoped, page);
  }

  async listForLocation(
    auth: AuthContext,
    locationId: string,
    filters: Omit<AngkatanFilters, "locationId" | "locationIds">,
    page: PageRequest,
  ): Promise<ListResult<Angkatan>> {
    assertLocationScope(auth, locationId);
    return this.angkatan.list({ ...filters, locationId }, page);
  }

  async getById(auth: AuthContext, id: string): Promise<Angkatan> {
    const found = await this.angkatan.findById(id);
    if (!found || found.deletedAt) throw AppError.notFound("Angkatan not found.");
    assertLocationScope(auth, found.locationId);
    return found;
  }

  async create(auth: AuthContext, input: CreateAngkatanInput): Promise<Angkatan> {
    assertAdmin(auth);
    validateName(input.name);
    validateDateRange(input.startDate, input.endDate);

    const location = await this.locations.findById(input.locationId);
    if (!location || location.deletedAt) {
      throw AppError.validation("locationId must reference an existing location.", {
        locationId: "Invalid location.",
      });
    }

    const existing = await this.angkatan.findActiveByName(input.locationId, input.name);
    if (existing) {
      throw AppError.conflict("An active angkatan with this name already exists at this location.");
    }

    const now = this.clock.nowIso();
    const angkatan: Angkatan = {
      id: uuid(),
      locationId: input.locationId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.angkatan.create(angkatan);
    return angkatan;
  }

  async update(auth: AuthContext, id: string, input: UpdateAngkatanInput): Promise<Angkatan> {
    assertAdmin(auth);
    const existing = await this.angkatan.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Angkatan not found.");

    if (input.name !== undefined) validateName(input.name);
    const nextStart = input.startDate ?? existing.startDate;
    const nextEnd = input.endDate ?? existing.endDate;
    validateDateRange(nextStart, nextEnd);

    if (input.name && input.name !== existing.name) {
      const duplicate = await this.angkatan.findActiveByName(existing.locationId, input.name);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(
          "An active angkatan with this name already exists at this location.",
        );
      }
    }

    const now = this.clock.nowIso();
    const patch: Partial<Angkatan> = { updatedAt: now };
    if (input.name !== undefined) patch.name = input.name;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;

    await this.angkatan.update(id, patch);

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "angkatan",
      resourceId: id,
      context: { operation: "update" },
      createdAt: now,
    });

    return { ...existing, ...patch };
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    assertAdmin(auth);
    const existing = await this.angkatan.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Angkatan not found.");

    const hasStudents = await this.angkatan.hasStudents(id);
    if (hasStudents) {
      throw AppError.conflict("Cannot delete an angkatan that still has students assigned to it.");
    }

    await this.angkatan.softDelete(id);
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "DELETE",
      resourceType: "angkatan",
      resourceId: id,
      context: null,
      createdAt: this.clock.nowIso(),
    });
  }
}
