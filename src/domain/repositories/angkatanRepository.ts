import { Angkatan } from "../entities/angkatan";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface AngkatanFilters {
  search?: string;
  locationId?: string;
  locationIds?: string[];
}

export interface AngkatanRepository {
  findById(id: string): Promise<Angkatan | null>;
  findActiveByName(locationId: string, name: string): Promise<Angkatan | null>;
  list(filters: AngkatanFilters, page: PageRequest): Promise<ListResult<Angkatan>>;
  create(angkatan: Angkatan): Promise<void>;
  update(id: string, patch: Partial<Angkatan>): Promise<void>;
  softDelete(id: string): Promise<void>;
  /** Whether any non-archived student currently references this angkatan. */
  hasStudents(id: string): Promise<boolean>;
}
