export type UserRole = "ADMIN" | "LOCATION_OPERATOR";

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserLocationAssignment {
  id: string;
  userId: string;
  locationId: string;
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
