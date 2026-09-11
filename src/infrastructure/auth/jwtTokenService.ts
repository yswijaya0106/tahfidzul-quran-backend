import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AccessTokenPayload, TokenService } from "../../application/auth/ports";
import { AppError } from "../../domain/errors";

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessTokenSecret: string,
    private readonly accessTokenExpiresIn: string,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    const options: jwt.SignOptions = {
      expiresIn: this.accessTokenExpiresIn as jwt.SignOptions["expiresIn"],
    };
    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret);
      return decoded as unknown as AccessTokenPayload;
    } catch {
      throw AppError.unauthenticated("The access token is invalid or has expired.");
    }
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(48).toString("hex");
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
