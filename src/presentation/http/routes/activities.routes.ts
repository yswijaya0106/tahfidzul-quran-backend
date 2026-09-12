import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const photoSchema = z.object({
  objectKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  caption: z.string().nullish(),
  displayOrder: z.number().int().min(0),
});

const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullish(),
  activityDate: z.string().date().or(z.string().datetime()),
  photos: z.array(photoSchema).default([]),
});

const updateActivitySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullish(),
  activityDate: z.string().date().or(z.string().datetime()).optional(),
  photos: z.array(photoSchema).optional(),
});

const locationIdParams = z.object({ id: z.string().uuid() });
const activityIdParams = z.object({ id: z.string().uuid() });

export default async function activitiesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/locations/:id/activities",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = locationIdParams.parse(request.params);
      const query = request.query as Record<string, string>;
      const page = parsePageRequest(query);
      return fastify.container.activityUseCases.listForLocation(
        request.auth,
        id,
        { dateFrom: query.dateFrom, dateTo: query.dateTo },
        page,
      );
    },
  );

  fastify.post(
    "/api/v1/locations/:id/activities",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = locationIdParams.parse(request.params);
      const input = createActivitySchema.parse(request.body);
      const data = await fastify.container.activityUseCases.create(request.auth, {
        ...input,
        locationId: id,
      });
      reply.status(201).send({ data });
    },
  );

  fastify.get("/api/v1/activities/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = activityIdParams.parse(request.params);
    const data = await fastify.container.activityUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.get(
    "/api/v1/activities/:id/photos",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = activityIdParams.parse(request.params);
      const data = await fastify.container.activityUseCases.getPhotos(request.auth, id);
      return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
    },
  );

  fastify.patch("/api/v1/activities/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = activityIdParams.parse(request.params);
    const input = updateActivitySchema.parse(request.body);
    const data = await fastify.container.activityUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.delete(
    "/api/v1/activities/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = activityIdParams.parse(request.params);
      await fastify.container.activityUseCases.archive(request.auth, id);
      reply.status(204).send();
    },
  );
}
