import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const citiesQuerySchema = z.object({ provinceId: z.coerce.number().int().positive().optional() });

export default async function refDataRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/ref/provinces", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const data = await fastify.container.refDataUseCases.listProvinces();
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  });

  fastify.get("/api/v1/ref/cities", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { provinceId } = citiesQuerySchema.parse(request.query);
    const data = await fastify.container.refDataUseCases.listCities(provinceId);
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  });
}
