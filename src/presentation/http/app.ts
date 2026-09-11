import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "crypto";
import "./types";
import { config } from "../../infrastructure/config";
import { buildContainer, Container } from "../../infrastructure/container";
import { errorHandler } from "./errorHandler";
import authenticatePlugin from "./plugins/authenticate";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import locationsRoutes from "./routes/locations.routes";
import studentsRoutes from "./routes/students.routes";
import assessmentsRoutes from "./routes/assessments.routes";
import activitiesRoutes from "./routes/activities.routes";
import quranRoutes from "./routes/quran.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import filesRoutes from "./routes/files.routes";

export async function buildApp(container?: Container): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
      redact: {
        paths: [
          "req.headers.authorization",
          "password",
          "passwordHash",
          "accessToken",
          "refreshToken",
          "nik",
          "nikEncrypted",
        ],
        censor: "[REDACTED]",
      },
    },
    genReqId: () => randomUUID(),
  });

  fastify.decorate("container", container ?? (await buildContainer()));

  await fastify.register(helmet);
  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: [],
  });

  await fastify.register(authenticatePlugin);

  // Stricter rate limit for authentication endpoints to slow brute-force attempts.
  await fastify.register(
    async (instance) => {
      await instance.register(rateLimit, { max: 10, timeWindow: "1 minute" });
      await instance.register(authRoutes);
    },
    { prefix: "" },
  );

  await fastify.register(usersRoutes);
  await fastify.register(locationsRoutes);
  await fastify.register(studentsRoutes);
  await fastify.register(assessmentsRoutes);
  await fastify.register(activitiesRoutes);
  await fastify.register(quranRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(filesRoutes);

  fastify.setErrorHandler(errorHandler);

  fastify.get("/healthz", async () => ({ status: "ok" }));

  return fastify;
}
