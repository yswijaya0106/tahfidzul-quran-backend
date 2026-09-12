import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const dayNumberParams = z.object({ dayNumber: z.coerce.number().int() });

const createDailyTargetSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(300),
  startSurahNumber: z.coerce.number().int().min(1).max(114),
  startVerseNumber: z.coerce.number().int().min(1),
  endSurahNumber: z.coerce.number().int().min(1).max(114),
  endVerseNumber: z.coerce.number().int().min(1),
});

const updateDailyTargetSchema = createDailyTargetSchema.omit({ dayNumber: true }).partial();

export default async function dailyTargetsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/daily-targets",
    { preHandler: fastify.authenticate },
    async () => {
      const data = await fastify.container.dailyTargetUseCases.list();
      return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
    },
  );

  fastify.get(
    "/api/v1/daily-targets/:dayNumber",
    { preHandler: fastify.authenticate },
    async (request) => {
      const { dayNumber } = dayNumberParams.parse(request.params);
      const data = await fastify.container.dailyTargetUseCases.getByDayNumber(dayNumber);
      return { data };
    },
  );

  fastify.post(
    "/api/v1/daily-targets",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const input = createDailyTargetSchema.parse(request.body);
      const data = await fastify.container.dailyTargetUseCases.create(request.auth, input);
      reply.status(201).send({ data });
    },
  );

  fastify.patch(
    "/api/v1/daily-targets/:dayNumber",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { dayNumber } = dayNumberParams.parse(request.params);
      const input = updateDailyTargetSchema.parse(request.body);
      const data = await fastify.container.dailyTargetUseCases.update(
        request.auth,
        dayNumber,
        input,
      );
      return { data };
    },
  );

  fastify.delete(
    "/api/v1/daily-targets/:dayNumber",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { dayNumber } = dayNumberParams.parse(request.params);
      await fastify.container.dailyTargetUseCases.delete(request.auth, dayNumber);
      reply.status(204).send();
    },
  );
}
