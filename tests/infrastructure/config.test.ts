import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { required } from "../../src/infrastructure/config";

const OPTIONAL_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "LOG_LEVEL",
  "CORS_ORIGIN",
  "ASSESSMENT_CLOCK_SKEW_MINUTES",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_CONNECTION_LIMIT",
  "JWT_ACCESS_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "REFRESH_TOKEN_TTL_DAYS",
  "NIK_ENCRYPTION_KEY",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE",
  "S3_SIGNED_URL_TTL_SECONDS",
];

vi.mock("dotenv/config", () => ({}));

describe("config defaults", () => {
  const originalValues = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of OPTIONAL_ENV_VARS) {
      originalValues.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of OPTIONAL_ENV_VARS) {
      const value = originalValues.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  });

  it("falls back to documented defaults when no environment variables are set", async () => {
    vi.resetModules();
    const { config } = await import("../../src/infrastructure/config.js");

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe("info");
    expect(config.corsOrigin).toBe("*");
    expect(config.assessmentClockSkewMinutes).toBe(5);

    expect(config.db.host).toBe("127.0.0.1");
    expect(config.db.port).toBe(3306);
    expect(config.db.user).toBe("root");
    expect(config.db.password).toBe("");
    expect(config.db.database).toBe("tahfidz_quran");
    expect(config.db.connectionLimit).toBe(10);

    expect(config.auth.accessTokenSecret).toBe("dev-secret");
    expect(config.auth.accessTokenExpiresIn).toBe("15m");
    expect(config.auth.refreshTokenTtlDays).toBe(30);
    expect(config.auth.nikEncryptionKeyHex).toHaveLength(64);

    expect(config.storage.endpoint).toBe("http://127.0.0.1:9000");
    expect(config.storage.region).toBe("us-east-1");
    expect(config.storage.bucket).toBe("tahfidz-quran-private");
    expect(config.storage.accessKeyId).toBe("");
    expect(config.storage.secretAccessKey).toBe("");
    expect(config.storage.forcePathStyle).toBe(true);
    expect(config.storage.signedUrlTtlSeconds).toBe(300);
  });

  it("disables forcePathStyle when S3_FORCE_PATH_STYLE is not 'true'", async () => {
    process.env.S3_FORCE_PATH_STYLE = "false";
    vi.resetModules();
    const { config } = await import("../../src/infrastructure/config.js");
    expect(config.storage.forcePathStyle).toBe(false);
  });
});

describe("required", () => {
  it("returns the environment value when set", () => {
    process.env.__TEST_REQUIRED_VAR__ = "from-env";
    expect(required("__TEST_REQUIRED_VAR__", "fallback")).toBe("from-env");
    delete process.env.__TEST_REQUIRED_VAR__;
  });

  it("falls back when the environment value is unset", () => {
    delete process.env.__TEST_REQUIRED_VAR__;
    expect(required("__TEST_REQUIRED_VAR__", "fallback")).toBe("fallback");
  });

  it("throws when neither the environment value nor a fallback is present", () => {
    delete process.env.__TEST_REQUIRED_VAR__;
    expect(() => required("__TEST_REQUIRED_VAR__")).toThrow(/Missing required environment/);
  });
});
