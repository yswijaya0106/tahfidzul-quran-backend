import { v4 as uuid } from "uuid";
import { UserRepository } from "../../domain/repositories/userRepository";
import { RefreshTokenRepository } from "../../domain/repositories/refreshTokenRepository";
import { AppError } from "../../domain/errors";
import { TokenService, Clock } from "./ports";

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** Rotates refresh tokens: the presented token is revoked and a new one is issued. */
export class RefreshUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
    private readonly refreshTokenTtlDays: number,
  ) {}

  async execute(presentedRefreshToken: string): Promise<RefreshResult> {
    const tokenHash = this.tokenService.hashRefreshToken(presentedRefreshToken);
    const stored = await this.refreshTokens.findByTokenHash(tokenHash);

    if (!stored || stored.revokedAt) {
      throw AppError.unauthenticated("The refresh token is invalid or has been revoked.");
    }
    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      throw AppError.unauthenticated("The refresh token has expired.");
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw AppError.unauthenticated("The account is no longer active.");
    }

    await this.refreshTokens.revoke(stored.id);

    const accessToken = this.tokenService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = this.tokenService.generateRefreshToken();
    const newHash = this.tokenService.hashRefreshToken(refreshToken);

    const now = new Date(this.clock.nowIso());
    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlDays * 86_400_000);

    await this.refreshTokens.create({
      id: uuid(),
      userId: user.id,
      tokenHash: newHash,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      createdAt: now.toISOString(),
    });

    return { accessToken, refreshToken };
  }
}
