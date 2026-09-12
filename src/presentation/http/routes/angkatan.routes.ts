import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const createAngkatanSchema = z.object({
  name: z.string().min(2).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

const updateAngkatanSchema = createAngkatanSchema.partial();

const locationIdParams = z.object({ id: z.string().uuid() });
const angkatanIdParams = z.object({ id: z.string().uuid() });

export default async function angkatanRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/locations/:id/angkatan",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = locationIdParams.parse(request.params);
      const query = request.query as Record<string, string>;
      const page = parsePageRequest(query);
      return fastify.container.angkatanUseCases.listForLocation(
        request.auth,
        id,
        { search: query.search },
        page,
      );
    },
  );

  fastify.post(
    "/api/v1/locations/:id/angkatan",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = locationIdParams.parse(request.params);
      const input = createAngkatanSchema.parse(request.body);
      const data = await fastify.container.angkatanUseCases.create(request.auth, {
        ...input,
        locationId: id,
      });
      reply.status(201).send({ data });
    },
  );

  fastify.get("/api/v1/angkatan/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = angkatanIdParams.parse(request.params);
    const data = await fastify.container.angkatanUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.patch("/api/v1/angkatan/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = angkatanIdParams.parse(request.params);
    const input = updateAngkatanSchema.parse(request.body);
    const data = await fastify.container.angkatanUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.delete(
    "/api/v1/angkatan/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = angkatanIdParams.parse(request.params);
      await fastify.container.angkatanUseCases.remove(request.auth, id);
      reply.status(204).send();
    },
  );
}
