import { describe, expect, it } from "vitest";
import { JwtTokenService } from "../../src/infrastructure/auth/jwtTokenService";

describe("JwtTokenService", () => {
  it("signs and verifies an access token", () => {
    const service = new JwtTokenService("secret", "15m");
    const token = service.signAccessToken({ sub: "user-1", role: "ADMIN" });
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("rejects an invalid access token", () => {
    const service = new JwtTokenService("secret", "15m");
    expect(() => service.verifyAccessToken("not-a-token")).toThrow(/invalid or has expired/);
  });

  it("rejects a token signed with a different secret", () => {
    const service = new JwtTokenService("secret", "15m");
    const other = new JwtTokenService("different-secret", "15m");
    const token = other.signAccessToken({ sub: "user-1", role: "ADMIN" });
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it("generates unique refresh tokens", () => {
    const service = new JwtTokenService("secret", "15m");
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(96);
  });

  it("hashes a refresh token deterministically", () => {
    const service = new JwtTokenService("secret", "15m");
    const hashA = service.hashRefreshToken("token");
    const hashB = service.hashRefreshToken("token");
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });
});
