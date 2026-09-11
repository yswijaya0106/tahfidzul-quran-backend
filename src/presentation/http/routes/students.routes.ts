import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";
import { parsePageRequest } from "../../../shared/pagination";

const createStudentSchema = z.object({
  fullName: z.string().min(1).max(150),
  locationId: z.string().uuid(),
  nik: z.string().min(1).max(32).nullish(),
  guardianName: z.string().nullish(),
  address: z.string().nullish(),
  studentPhone: z.string().nullish(),
  guardianPhone: z.string().nullish(),
});

const updateStudentSchema = createStudentSchema.omit({ locationId: true }).partial();

const idParams = z.object({ id: z.string().uuid() });

export default async function studentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/students", { preHandler: fastify.authenticate }, async (request) => {
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
        status: query.status as "ACTIVE" | "ARCHIVED" | undefined,
      },
      page,
    );
  });

  fastify.get("/api/v1/students/:id", { preHandler: fastify.authenticate }, async (request) => {
    if (!request.auth) throw AppError.unauthenticated();
    const { id } = idParams.parse(request.params);
    const data = await fastify.container.studentUseCases.getById(request.auth, id);
    return { data };
  });

  fastify.post("/api/v1/students", { preHandler: fastify.authenticate }, async (request, reply) => {
    if (!request.auth) throw AppError.unauthenticated();
    const input = createStudentSchema.parse(request.body);
    const data = await fastify.container.studentUseCases.create(request.auth, input);
    reply.status(201).send({ data });
  });

  fastify.patch("/api/v1/students/:id", { preHandler: fastify.authenticate }, async (request) => {
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
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      await fastify.container.studentUseCases.archive(request.auth, id);
      reply.status(204).send();
    },
  );
}
