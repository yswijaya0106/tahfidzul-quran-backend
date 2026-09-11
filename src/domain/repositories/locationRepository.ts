import {
  Location,
  LocationOrganizationMember,
  LocationStatus,
  LocationWithMembers,
} from "../entities/location";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface LocationFilters {
  status?: LocationStatus;
  search?: string;
  ids?: string[];
}

export interface LocationRepository {
  findById(id: string): Promise<LocationWithMembers | null>;
  findActiveByName(name: string): Promise<Location | null>;
  list(filters: LocationFilters, page: PageRequest): Promise<ListResult<Location>>;
  create(location: Location, members: LocationOrganizationMember[]): Promise<void>;
  update(id: string, patch: Partial<Location>): Promise<void>;
  replaceMembers(locationId: string, members: LocationOrganizationMember[]): Promise<void>;
  softDelete(id: string): Promise<void>;
}
