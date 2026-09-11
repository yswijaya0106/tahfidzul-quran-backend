import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const presignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

const completeSchema = z.object({ objectKey: z.string().min(1) });

/**
 * In-memory idempotency cache for file-completion requests. A production
 * deployment should back this with a shared store (e.g. Redis) so retries
 * are deduplicated across processes.
 */
const idempotencyCache = new Map<string, unknown>();

export default async function filesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/api/v1/files/presign",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const input = presignSchema.parse(request.body);
      const data = await fastify.container.fileUseCases.presign(input);
      reply.status(201).send({ data });
    },
  );

  fastify.post(
    "/api/v1/files/:id/complete",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const idempotencyKey = request.headers["idempotency-key"] as string | undefined;
      if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
        reply.status(200).send({ data: idempotencyCache.get(idempotencyKey) });
        return;
      }

      const input = completeSchema.parse(request.body);
      const data = await fastify.container.fileUseCases.complete(input);

      if (idempotencyKey) idempotencyCache.set(idempotencyKey, data);
      reply.status(200).send({ data });
    },
  );
}
