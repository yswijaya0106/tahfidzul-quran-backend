import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { Grade, GRADES } from "../../../domain/entities/grade";
import { parsePageRequest } from "../../../shared/pagination";

const gradeEnum = z.enum(GRADES as unknown as [Grade, ...Grade[]]);

const createIkhtibarSchema = z.object({
  examDate: z.string().datetime().or(z.string().date()),
  juzFrom: z.coerce.number().int().min(1).max(30),
  juzTo: z.coerce.number().int().min(1).max(30),
  grade: gradeEnum,
  score: z.coerce.number().min(0).max(100),
  notes: z.string().nullish(),
});

const updateIkhtibarSchema = createIkhtibarSchema.partial();

const studentIdParams = z.object({ id: z.string().uuid() });
const ikhtibarIdParams = z.object({ id: z.string().uuid() });

export default async function ikhtibarRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/students/:id/ikhtibar",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = studentIdParams.parse(request.params);
      const query = request.query as Record<string, string>;
      const page = parsePageRequest(query);
      return fastify.container.ikhtibarUseCases.listForStudent(
        request.auth,
        id,
        { dateFrom: query.dateFrom, dateTo: query.dateTo },
        page,
      );
    },
  );

  fastify.post(
    "/api/v1/students/:id/ikhtibar",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = studentIdParams.parse(request.params);
      const input = createIkhtibarSchema.parse(request.body);
      const data = await fastify.container.ikhtibarUseCases.create(request.auth, id, input);
      reply.status(201).send({ data });
    },
  );

  fastify.get("/api/v1/ikhtibar/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = ikhtibarIdParams.parse(request.params);
    const data = await fastify.container.ikhtibarUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.patch("/api/v1/ikhtibar/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = ikhtibarIdParams.parse(request.params);
    const input = updateIkhtibarSchema.parse(request.body);
    const data = await fastify.container.ikhtibarUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.delete(
    "/api/v1/ikhtibar/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = ikhtibarIdParams.parse(request.params);
      await fastify.container.ikhtibarUseCases.archive(request.auth, id);
      reply.status(204).send();
    },
  );
}
