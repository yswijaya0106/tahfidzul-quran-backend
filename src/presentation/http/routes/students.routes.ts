import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const createStudentSchema = z.object({
  fullName: z.string().min(1).max(150),
  locationId: z.string().uuid(),
  angkatanId: z.string().uuid().nullish(),
  programStartDate: z.string().date().nullish(),
  nik: z.string().min(1).max(32).nullish(),
  guardianName: z.string().nullish(),
  address: z.string().nullish(),
  studentPhone: z.string().nullish(),
  guardianPhone: z.string().nullish(),
});

const updateStudentSchema = createStudentSchema.omit({ locationId: true }).partial();

const idParams = z.object({ id: z.string().uuid() });

/** Defaults to the last 30 days, matching the dashboard's own default range. */
function last30DaysRange(): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export default async function studentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/students", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const query = request.query as Record<string, string>;
    const page = parsePageRequest(query);
    return fastify.container.studentUseCases.list(
      request.auth,
      {
        name: query.name,
        studentCode: query.studentCode,
        phone: query.phone,
        locationId: query.locationId,
        angkatanId: query.angkatanId,
        status: query.status as "ACTIVE" | "ARCHIVED" | undefined,
      },
      page,
    );
  });

  fastify.get("/api/v1/students/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const data = await fastify.container.studentUseCases.getById(request.auth, id);
    return { data };
  });

  // Combines the student profile with their memorization progress (latest
  // positions, grade distribution, recent history) in one round trip for the
  // mobile app's student profile screen.
  fastify.get(
    "/api/v1/students/:id/profile",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      const [profile, progress] = await Promise.all([
        fastify.container.studentUseCases.getById(request.auth, id),
        fastify.container.dashboardUseCases.getStudentDashboard(
          request.auth,
          id,
          last30DaysRange(),
          "UTC",
        ),
      ]);
      return { data: { profile, progress: progress.data } };
    },
  );

  fastify.post("/api/v1/students", { preHandler: fastify.authenticate }, async (request, reply) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const input = createStudentSchema.parse(request.body);
    const data = await fastify.container.studentUseCases.create(request.auth, input);
    reply.status(201).send({ data });
  });

  fastify.patch("/api/v1/students/:id", { preHandler: fastify.authenticate }, async (request) => {
    /* v8 ignore next */
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const input = updateStudentSchema.parse(request.body);
    const data = await fastify.container.studentUseCases.update(request.auth, id, input);
    return { data };
  });

  fastify.post(
    "/api/v1/students/:id/archive",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      await fastify.container.studentUseCases.archive(request.auth, id);
      reply.status(204).send();
    },
  );
}
