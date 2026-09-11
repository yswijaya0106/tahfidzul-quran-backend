import { Activity, ActivityPhoto } from "../entities/activity";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface ActivityFilters {
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ActivityRepository {
  findById(id: string): Promise<Activity | null>;
  list(filters: ActivityFilters, page: PageRequest): Promise<ListResult<Activity>>;
  create(activity: Activity, photos: ActivityPhoto[]): Promise<void>;
  update(id: string, patch: Partial<Activity>): Promise<void>;
  archive(id: string): Promise<void>;
  replacePhotos(activityId: string, photos: ActivityPhoto[]): Promise<void>;
  listPhotos(activityId: string): Promise<ActivityPhoto[]>;
}
