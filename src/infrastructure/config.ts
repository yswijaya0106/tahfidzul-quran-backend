import "dotenv/config";

export function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? "info",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  assessmentClockSkewMinutes: Number(process.env.ASSESSMENT_CLOCK_SKEW_MINUTES ?? 5),

  db: {
    host: required("DB_HOST", "127.0.0.1"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER", "root"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME", "tahfidz_quran"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  },

  auth: {
    accessTokenSecret: required("JWT_ACCESS_SECRET", "dev-secret"),
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
    nikEncryptionKeyHex: required(
      "NIK_ENCRYPTION_KEY",
      "0000000000000000000000000000000000000000000000000000000000000000",
    ),
  },

  storage: {
    endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: required("S3_BUCKET", "tahfidz-quran-private"),
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    signedUrlTtlSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 300),
  },
};
