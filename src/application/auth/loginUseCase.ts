import { v4 as uuid } from "uuid";
import { UserRepository } from "../../domain/repositories/userRepository";
import { RefreshTokenRepository } from "../../domain/repositories/refreshTokenRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { AppError } from "../../domain/errors";
import { toPublicUser, PublicUser } from "../../domain/entities/user";
import { PasswordHasher, TokenService, Clock } from "./ports";

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
    private readonly refreshTokenTtlDays: number,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    // Generic failure message: the API must not reveal whether an account exists.
    const genericError = () => AppError.unauthenticated("Invalid credentials.");

    const user = await this.users.findByEmailOrPhone(input.identifier);
    if (!user || !user.isActive || user.deletedAt) {
      throw genericError();
    }

    const passwordOk = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!passwordOk) {
      throw genericError();
    }

    const accessToken = this.tokenService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);

    const now = new Date(this.clock.nowIso());
    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlDays * 86_400_000);

    await this.refreshTokens.create({
      id: uuid(),
      userId: user.id,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      createdAt: now.toISOString(),
    });

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: user.id,
      action: "LOGIN",
      resourceType: "user",
      resourceId: user.id,
      context: null,
      createdAt: now.toISOString(),
    });

    return { user: toPublicUser(user), accessToken, refreshToken };
  }
}
