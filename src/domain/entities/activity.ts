export type PhotoProcessingStatus = "PENDING" | "READY" | "FAILED";

export interface Activity {
  id: string;
  locationId: string;
  title: string;
  description: string | null;
  activityDate: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ActivityPhoto {
  id: string;
  activityId: string;
  objectKey: string;
  caption: string | null;
  displayOrder: number;
  thumbnailObjectKey: string | null;
  processingStatus: PhotoProcessingStatus;
  createdAt: string;
  deletedAt: string | null;
}
