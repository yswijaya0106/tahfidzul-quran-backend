import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const memberSchema = z.object({
  name: z.string().min(1).max(150),
  roleTitle: z.string().min(1).max(150),
  phone: z.string().max(32).nullish(),
});

const createLocationSchema = z.object({
  name: z.string().min(2).max(150),
  address: z.string().min(1),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  phone: z.string().max(32).nullish(),
  description: z.string().nullish(),
  organizationMembers: z.array(memberSchema).optional(),
});

const updateLocationSchema = createLocationSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

export default async function locationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/locations", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const query = request.query as Record<string, string>;
    const page = parsePageRequest(query);
    return fastify.container.locationUseCases.list(
      request.auth,
      { status: query.status as "ACTIVE" | "INACTIVE" | undefined, search: query.search },
      page,
    );
  });

  fastify.get("/api/v1/locations/:id", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const data = await fastify.container.locationUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.post(
    "/api/v1/locations",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.auth) throw AppError.unauthenticated();
      const input = createLocationSchema.parse(request.body);
      const data = await fastify.container.locationUseCases.create(request.auth, input);
      reply.status(201).send({ data });
    },
  );

  fastify.patch("/api/v1/locations/:id", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const input = updateLocationSchema.parse(request.body);
    const data = await fastify.container.locationUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.delete(
    "/api/v1/locations/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      await fastify.container.locationUseCases.remove(request.auth, id);
      reply.status(204).send();
    },
  );
}
