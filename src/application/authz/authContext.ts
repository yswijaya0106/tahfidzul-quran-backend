import { UserRole } from "../../domain/entities/user";
import { AppError } from "../../domain/errors";

export interface AuthContext {
  userId: string;
  role: UserRole;
  assignedLocationIds: string[];
}

export function assertAdmin(auth: AuthContext): void {
  if (auth.role !== "ADMIN") {
    throw AppError.forbidden("This operation is restricted to administrators.");
  }
}

/**
 * Ensures the authenticated user may act on the given location.
 * Admins may act on any location; location operators only on assigned ones.
 */
export function assertLocationScope(auth: AuthContext, locationId: string): void {
  if (auth.role === "ADMIN") return;
  if (!auth.assignedLocationIds.includes(locationId)) {
    throw AppError.forbidden("You are not assigned to this location.");
  }
}
