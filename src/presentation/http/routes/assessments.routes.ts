import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { Grade, GRADES } from "../../../domain/entities/grade";
import { parsePageRequest } from "../../../shared/pagination";

const gradeEnum = z.enum(GRADES as unknown as [Grade, ...Grade[]]);

const createAssessmentSchema = z.object({
  assessmentDate: z.string().datetime().or(z.string().date()),
  assessmentType: z.enum(["NEW_MEMORIZATION", "MUROJAAH"]),
  startSurahNumber: z.coerce.number().int().min(1).max(114),
  startVerseNumber: z.coerce.number().int().min(1),
  endSurahNumber: z.coerce.number().int().min(1).max(114),
  endVerseNumber: z.coerce.number().int().min(1),
  grade: gradeEnum,
  notes: z.string().nullish(),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

const studentIdParams = z.object({ id: z.string().uuid() });
const locationIdParams = z.object({ id: z.string().uuid() });
const assessmentIdParams = z.object({ id: z.string().uuid() });

export default async function assessmentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/locations/:id/assessments",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = locationIdParams.parse(request.params);
      const query = request.query as Record<string, string>;
      const page = parsePageRequest(query);
      return fastify.container.assessmentUseCases.listForLocation(
        request.auth,
        id,
        {
          assessmentType: query.assessmentType as "NEW_MEMORIZATION" | "MUROJAAH" | undefined,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        page,
      );
    },
  );

  fastify.get(
    "/api/v1/students/:id/assessments",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = studentIdParams.parse(request.params);
      const query = request.query as Record<string, string>;
      const page = parsePageRequest(query);
      return fastify.container.assessmentUseCases.listForStudent(
        request.auth,
        id,
        {
          assessmentType: query.assessmentType as "NEW_MEMORIZATION" | "MUROJAAH" | undefined,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        page,
      );
    },
  );

  fastify.post(
    "/api/v1/students/:id/assessments",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = studentIdParams.parse(request.params);
      const input = createAssessmentSchema.parse(request.body);
      const data = await fastify.container.assessmentUseCases.create(request.auth, id, input);
      reply.status(201).send({ data });
    },
  );

  fastify.get("/api/v1/assessments/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = assessmentIdParams.parse(request.params);
    const data = await fastify.container.assessmentUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.patch(
    "/api/v1/assessments/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = assessmentIdParams.parse(request.params);
      const input = updateAssessmentSchema.parse(request.body);
      const data = await fastify.container.assessmentUseCases.update(request.auth, id, input);
      return { data };
    },
  );

  fastify.delete(
    "/api/v1/assessments/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = assessmentIdParams.parse(request.params);
      await fastify.container.assessmentUseCases.archive(request.auth, id);
      reply.status(204).send();
    },
  );
}
