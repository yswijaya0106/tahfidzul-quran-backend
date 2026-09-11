import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/api/v1/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await fastify.container.login.execute(input);
    reply.status(200).send({ data: result });
  });

  fastify.post("/api/v1/auth/refresh", async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const result = await fastify.container.refresh.execute(refreshToken);
    reply.status(200).send({ data: result });
  });

  fastify.post(
    "/api/v1/auth/logout",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { refreshToken } = refreshSchema.parse(request.body);
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      await fastify.container.logout.execute(request.auth.userId, refreshToken);
      reply.status(204).send();
    },
  );

  fastify.post(
    "/api/v1/auth/logout-all",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      await fastify.container.logoutAll.execute(request.auth.userId);
      reply.status(204).send();
    },
  );
}
