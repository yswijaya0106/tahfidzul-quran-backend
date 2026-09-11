import { UserRole } from "../../domain/entities/user";

export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hash: string): Promise<boolean>;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string;
}

export interface Clock {
  nowIso(): string;
}
