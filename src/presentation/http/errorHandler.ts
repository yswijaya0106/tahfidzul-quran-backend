import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logging/logger";

function zodErrorToFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] = issue.message;
  }
  return fields;
}

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = request.id;

  if (error instanceof AppError) {
    reply.status(error.status).send({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
        requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        fields: zodErrorToFields(error),
        requestId,
      },
    });
    return;
  }

  logger.error({ err: error, requestId }, "Unhandled error");
  reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  });
}
