import pino from "pino";
import { config } from "../config";

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "token",
  "nik",
  "nikEncrypted",
  "signedUrl",
  "uploadUrl",
];

export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  redact: {
    paths: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `req.body.${key}`]),
    censor: "[REDACTED]",
  },
});
