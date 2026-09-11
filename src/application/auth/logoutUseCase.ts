import { v4 as uuid } from "uuid";
import { RefreshTokenRepository } from "../../domain/repositories/refreshTokenRepository";
import { AuditLogRepository } from "../../domain/repositories/auditLogRepository";
import { TokenService, Clock } from "./ports";

export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, presentedRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(presentedRefreshToken);
    const stored = await this.refreshTokens.findByTokenHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }

    await this.auditLogs.record({
      id: uuid(),
      actorUserId: userId,
      action: "LOGOUT",
      resourceType: "user",
      resourceId: userId,
      context: { scope: "current-device" },
      createdAt: this.clock.nowIso(),
    });
  }
}

export class LogoutAllUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    await this.auditLogs.record({
      id: uuid(),
      actorUserId: userId,
      action: "LOGOUT",
      resourceType: "user",
      resourceId: userId,
      context: { scope: "all-devices" },
      createdAt: this.clock.nowIso(),
    });
  }
}
