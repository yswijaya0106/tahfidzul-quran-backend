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

export function transportFor(
  nodeEnv: string,
): { target: string; options: { colorize: boolean } } | undefined {
  return nodeEnv === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined;
}

export const logger = pino({
  level: config.logLevel,
  transport: transportFor(config.nodeEnv),
  redact: {
    paths: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `req.body.${key}`]),
    censor: "[REDACTED]",
  },
});
