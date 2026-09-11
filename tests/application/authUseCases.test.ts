import { describe, expect, it } from "vitest";
import { LogoutUseCase, LogoutAllUseCase } from "../../src/application/auth/logoutUseCase";
import { RefreshUseCase } from "../../src/application/auth/refreshUseCase";
import { LoginUseCase } from "../../src/application/auth/loginUseCase";
import { StoredRefreshToken } from "../../src/domain/repositories/refreshTokenRepository";
import { User } from "../../src/domain/entities/user";

class FakeRefreshTokenRepository {
  tokens: StoredRefreshToken[] = [];
  async create(token: StoredRefreshToken) {
    this.tokens.push(token);
  }
  async findByTokenHash(tokenHash: string) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async revoke(id: string) {
    const token = this.tokens.find((t) => t.id === id);
    if (token) token.revokedAt = "2026-01-01T00:00:00.000Z";
  }
  async revokeAllForUser(userId: string) {
    for (const token of this.tokens) {
      if (token.userId === userId) token.revokedAt = "2026-01-01T00:00:00.000Z";
    }
  }
}

class FakeAuditLogRepository {
  entries: unknown[] = [];
  async record(entry: unknown) {
    this.entries.push(entry);
  }
}

class FakeUserRepository {
  users: User[] = [];
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmailOrPhone() {
    return null;
  }
  async list() {
    return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  }
  async create() {}
  async update() {}
  async getAssignedLocationIds() {
    return [];
  }
  async assignLocations() {}
  async listAssignments() {
    return [];
  }
}

class FakeTokenService {
  signAccessToken() {
    return "access-token";
  }
  verifyAccessToken() {
    return { sub: "user-1", role: "ADMIN" as const };
  }
  generateRefreshToken() {
    return "new-refresh-token";
  }
  hashRefreshToken(token: string) {
    return `hash:${token}`;
  }
}

const clock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    fullName: "Test User",
    email: "user@example.com",
    phone: null,
    passwordHash: "hash",
    role: "ADMIN",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("LogoutUseCase", () => {
  it("revokes the presented refresh token and records an audit log", async () => {
    const refreshTokens = new FakeRefreshTokenRepository();
    const auditLogs = new FakeAuditLogRepository();
    refreshTokens.tokens.push({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash:presented",
      expiresAt: "2030-01-01T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const useCase = new LogoutUseCase(
      refreshTokens as never,
      auditLogs as never,
      new FakeTokenService(),
      clock,
    );
    await useCase.execute("user-1", "presented");

    expect(refreshTokens.tokens[0]!.revokedAt).not.toBeNull();
    expect(auditLogs.entries).toHaveLength(1);
  });

  it("still records an audit log when the token is unknown or already revoked", async () => {
    const refreshTokens = new FakeRefreshTokenRepository();
    const auditLogs = new FakeAuditLogRepository();
    const useCase = new LogoutUseCase(
      refreshTokens as never,
      auditLogs as never,
      new FakeTokenService(),
      clock,
    );
    await useCase.execute("user-1", "unknown-token");
    expect(auditLogs.entries).toHaveLength(1);
  });
});

describe("LogoutAllUseCase", () => {
  it("revokes all refresh tokens for the user and records an audit log", async () => {
    const refreshTokens = new FakeRefreshTokenRepository();
    const auditLogs = new FakeAuditLogRepository();
    refreshTokens.tokens.push(
      {
        id: "rt-1",
        userId: "user-1",
        tokenHash: "hash:1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "rt-2",
        userId: "user-1",
        tokenHash: "hash:2",
        expiresAt: "2030-01-01T00:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    );

    const useCase = new LogoutAllUseCase(refreshTokens as never, auditLogs as never, clock);
    await useCase.execute("user-1");

    expect(refreshTokens.tokens.every((t) => t.revokedAt)).toBe(true);
    expect(auditLogs.entries).toHaveLength(1);
  });
});

describe("RefreshUseCase", () => {
  function build() {
    const users = new FakeUserRepository();
    const refreshTokens = new FakeRefreshTokenRepository();
    const useCase = new RefreshUseCase(
      users as never,
      refreshTokens as never,
      new FakeTokenService(),
      clock,
      30,
    );
    return { useCase, users, refreshTokens };
  }

  it("rotates a valid refresh token", async () => {
    const { useCase, users, refreshTokens } = build();
    users.users.push(makeUser("user-1"));
    refreshTokens.tokens.push({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash:presented",
      expiresAt: "2030-01-01T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await useCase.execute("presented");
    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(refreshTokens.tokens[0]!.revokedAt).not.toBeNull();
  });

  it("rejects an unknown or revoked refresh token", async () => {
    const { useCase, refreshTokens } = build();
    await expect(useCase.execute("unknown")).rejects.toMatchObject({ status: 401 });

    refreshTokens.tokens.push({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash:revoked",
      expiresAt: "2030-01-01T00:00:00.000Z",
      revokedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(useCase.execute("revoked")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an expired refresh token", async () => {
    const { useCase, refreshTokens } = build();
    refreshTokens.tokens.push({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash:expired",
      expiresAt: "2020-01-01T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    await expect(useCase.execute("expired")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects when the user is inactive, deleted, or missing", async () => {
    const { useCase, users, refreshTokens } = build();
    refreshTokens.tokens.push({
      id: "rt-1",
      userId: "missing-user",
      tokenHash: "hash:presented",
      expiresAt: "2030-01-01T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(useCase.execute("presented")).rejects.toMatchObject({ status: 401 });

    users.users.push(makeUser("user-2", { isActive: false }));
    refreshTokens.tokens.push({
      id: "rt-2",
      userId: "user-2",
      tokenHash: "hash:inactive",
      expiresAt: "2030-01-01T00:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(useCase.execute("inactive")).rejects.toMatchObject({ status: 401 });
  });
});

class FakePasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

class FakeLoginUserRepository {
  constructor(private readonly users: User[]) {}
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByEmailOrPhone(identifier: string) {
    return this.users.find((u) => u.email === identifier || u.phone === identifier) ?? null;
  }
  async list() {
    return { data: this.users, meta: { page: 1, pageSize: 20, total: this.users.length } };
  }
  async create() {}
  async update() {}
  async getAssignedLocationIds() {
    return [];
  }
  async assignLocations() {}
  async listAssignments() {
    return [];
  }
}

describe("LoginUseCase", () => {
  function build(users: User[]) {
    const refreshTokens = new FakeRefreshTokenRepository();
    const auditLogs = new FakeAuditLogRepository();
    const useCase = new LoginUseCase(
      new FakeLoginUserRepository(users) as never,
      refreshTokens as never,
      auditLogs as never,
      new FakePasswordHasher(),
      new FakeTokenService(),
      clock,
      30,
    );
    return { useCase, refreshTokens, auditLogs };
  }

  it("logs in with a correct password", async () => {
    const user = makeUser("user-1", { email: "user@example.com", passwordHash: "hashed:correct" });
    const { useCase } = build([user]);

    const result = await useCase.execute({ identifier: "user@example.com", password: "correct" });
    expect(result.user.id).toBe("user-1");
    expect(result.accessToken).toBe("access-token");
  });

  it("rejects an unknown identifier", async () => {
    const { useCase } = build([]);
    await expect(
      useCase.execute({ identifier: "nobody@example.com", password: "x" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an inactive user", async () => {
    const user = makeUser("user-1", {
      email: "user@example.com",
      passwordHash: "hashed:correct",
      isActive: false,
    });
    const { useCase } = build([user]);
    await expect(
      useCase.execute({ identifier: "user@example.com", password: "correct" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a soft-deleted user", async () => {
    const user = makeUser("user-1", {
      email: "user@example.com",
      passwordHash: "hashed:correct",
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    const { useCase } = build([user]);
    await expect(
      useCase.execute({ identifier: "user@example.com", password: "correct" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an incorrect password", async () => {
    const user = makeUser("user-1", { email: "user@example.com", passwordHash: "hashed:correct" });
    const { useCase } = build([user]);
    await expect(
      useCase.execute({ identifier: "user@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
