import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const createUserSchema = z.object({
  fullName: z.string().min(2).max(150),
  email: z.string().email().nullish(),
  phone: z.string().min(6).max(32).nullish(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "LOCATION_OPERATOR"]),
  locationIds: z.array(z.string().uuid()).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  email: z.string().email().nullish(),
  phone: z.string().min(6).max(32).nullish(),
  role: z.enum(["ADMIN", "LOCATION_OPERATOR"]).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

export default async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/users", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const page = parsePageRequest(request.query as Record<string, string>);
    return fastify.container.userUseCases.list(request.auth, {}, page);
  });

  fastify.get("/api/v1/users/:id", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const data = await fastify.container.userUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.post("/api/v1/users", { preHandler: fastify.authenticate }, async (request, reply) => {
    if (!request.auth) throw AppError.unauthenticated();
    const input = createUserSchema.parse(request.body);
    const data = await fastify.container.userUseCases.create(request.auth, input);
    reply.status(201).send({ data });
  });

  fastify.patch("/api/v1/users/:id", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const input = updateUserSchema.parse(request.body);
    const data = await fastify.container.userUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.post(
    "/api/v1/users/:id/deactivate",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      await fastify.container.userUseCases.deactivate(request.auth, id);
      reply.status(204).send();
    },
  );
}
