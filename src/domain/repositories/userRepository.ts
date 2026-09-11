import { User, UserLocationAssignment, UserRole } from "../entities/user";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  list(filters: UserFilters, page: PageRequest): Promise<ListResult<User>>;
  create(user: User): Promise<void>;
  update(id: string, patch: Partial<User>): Promise<void>;
  getAssignedLocationIds(userId: string): Promise<string[]>;
  assignLocations(userId: string, locationIds: string[]): Promise<void>;
  listAssignments(userId: string): Promise<UserLocationAssignment[]>;
}
