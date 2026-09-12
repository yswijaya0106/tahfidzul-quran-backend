import { v4 as uuid } from "uuid";
import { ActivityRepository, ActivityFilters } from "../../domain/repositories/activityRepository";
import { LocationRepository } from "../../domain/repositories/locationRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { Activity, ActivityPhoto } from "../../domain/entities/activity";
import { PageRequest, ListResult } from "../../shared/pagination";
import { AuthContext, assertAdmin, assertLocationScope } from "../authz/authContext";
import { Clock } from "../auth/ports";
import { ObjectStorage } from "../files/ports";

export interface ActivityPhotoView {
  id: string;
  url: string;
  caption: string | null;
  displayOrder: number;
}

const ALLOWED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

export interface ActivityPhotoInput {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  displayOrder: number;
}

export interface CreateActivityInput {
  locationId: string;
  title: string;
  description?: string | null;
  activityDate: string;
  photos: ActivityPhotoInput[];
}

export interface UpdateActivityInput {
  title?: string;
  description?: string | null;
  activityDate?: string;
  photos?: ActivityPhotoInput[];
}

function validatePhotos(photos: ActivityPhotoInput[]): void {
  for (const photo of photos) {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(photo.mimeType)) {
      throw AppError.validation(`Unsupported photo MIME type: ${photo.mimeType}.`, {
        photos: "Unsupported MIME type.",
      });
    }
    if (photo.sizeBytes > MAX_PHOTO_SIZE_BYTES) {
      throw AppError.validation("Photo exceeds the maximum allowed size.", {
        photos: "File too large.",
      });
    }
  }
}

function toPhotoEntity(activityId: string, input: ActivityPhotoInput): ActivityPhoto {
  return {
    id: uuid(),
    activityId,
    objectKey: input.objectKey,
    caption: input.caption ?? null,
    displayOrder: input.displayOrder,
    thumbnailObjectKey: null,
    processingStatus: "PENDING",
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}

export class ActivityUseCases {
  constructor(
    private readonly activities: ActivityRepository,
    private readonly locations: LocationRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
    private readonly objectStorage: ObjectStorage,
  ) {}

  async listForLocation(
    auth: AuthContext,
    locationId: string,
    filters: Omit<ActivityFilters, "locationId">,
    page: PageRequest,
  ): Promise<ListResult<Activity>> {
    assertLocationScope(auth, locationId);
    return this.activities.list({ ...filters, locationId }, page);
  }

  async getById(auth: AuthContext, id: string): Promise<Activity> {
    const activity = await this.activities.findById(id);
    if (!activity || activity.deletedAt) throw AppError.notFound("Activity not found.");
    assertLocationScope(auth, activity.locationId);
    return activity;
  }

  /** Signed view URLs for an activity's photos, fetched only on demand (not
   * embedded in the activity list) so browsing many locations stays cheap. */
  async getPhotos(auth: AuthContext, activityId: string): Promise<ActivityPhotoView[]> {
    const activity = await this.activities.findById(activityId);
    if (!activity || activity.deletedAt) throw AppError.notFound("Activity not found.");
    assertLocationScope(auth, activity.locationId);

    const photos = await this.activities.listPhotos(activityId);
    return Promise.all(
      photos
        .filter((photo) => !photo.deletedAt)
        .map(async (photo) => ({
          id: photo.id,
          url: await this.objectStorage.createSignedDownloadUrl(photo.objectKey),
          caption: photo.caption,
          displayOrder: photo.displayOrder,
        })),
    );
  }

  async create(auth: AuthContext, input: CreateActivityInput): Promise<Activity> {
    assertAdmin(auth);
    validatePhotos(input.photos);

    const location = await this.locations.findById(input.locationId);
    if (!location || location.deletedAt) {
      throw AppError.validation("locationId must reference an existing location.", {
        locationId: "Invalid location.",
      });
    }

    const now = this.clock.nowIso();
    const activity: Activity = {
      id: uuid(),
      locationId: input.locationId,
      title: input.title,
      description: input.description ?? null,
      activityDate: input.activityDate,
      createdByUserId: auth.userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const photos = input.photos.map((photo) => toPhotoEntity(activity.id, photo));

    await this.activities.create(activity, photos);
    return activity;
  }

  async update(auth: AuthContext, id: string, input: UpdateActivityInput): Promise<Activity> {
    assertAdmin(auth);
    const existing = await this.activities.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Activity not found.");

    if (input.photos) validatePhotos(input.photos);

    const now = this.clock.nowIso();
    const patch: Partial<Activity> = { updatedAt: now };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.activityDate !== undefined) patch.activityDate = input.activityDate;

    await this.activities.update(id, patch);

    if (input.photos) {
      await this.activities.replacePhotos(
        id,
        input.photos.map((photo) => toPhotoEntity(id, photo)),
      );
    }

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "activity",
      resourceId: id,
      context: { operation: "update" },
      createdAt: now,
    });

    const updated = await this.activities.findById(id);
    return updated!;
  }

  async archive(auth: AuthContext, id: string): Promise<void> {
    assertAdmin(auth);
    const existing = await this.activities.findById(id);
    if (!existing || existing.deletedAt) throw AppError.notFound("Activity not found.");

    await this.activities.archive(id);
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: auth.userId,
      action: "ARCHIVE",
      resourceType: "activity",
      resourceId: id,
      context: null,
      createdAt: this.clock.nowIso(),
    });
  }
}
