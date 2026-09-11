import { Ikhtibar, IkhtibarRevision } from "../entities/ikhtibar";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface IkhtibarFilters {
  studentId?: string;
  locationId?: string;
  locationIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface IkhtibarRepository {
  findById(id: string): Promise<Ikhtibar | null>;
  list(filters: IkhtibarFilters, page: PageRequest): Promise<ListResult<Ikhtibar>>;
  create(ikhtibar: Ikhtibar): Promise<void>;
  update(id: string, patch: Partial<Ikhtibar>): Promise<void>;
  archive(id: string): Promise<void>;
  addRevision(revision: IkhtibarRevision): Promise<void>;
  listRevisions(ikhtibarId: string): Promise<IkhtibarRevision[]>;
}
