import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FastifyReply, FastifyRequest } from "fastify";
import { errorHandler } from "../../src/presentation/http/errorHandler";
import { AppError } from "../../src/domain/errors";

function makeReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

const request = { id: "req-1" } as FastifyRequest;

describe("errorHandler", () => {
  it("maps an AppError to its documented status and error shape", () => {
    const reply = makeReply();
    errorHandler(AppError.notFound("Missing."), request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: "NOT_FOUND", message: "Missing.", fields: undefined, requestId: "req-1" },
    });
  });

  it("maps a ZodError to a 400 VALIDATION_ERROR with field messages", () => {
    const reply = makeReply();
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 5 });
    if (result.success) throw new Error("expected failure");

    errorHandler(result.error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    const payload = reply.send.mock.calls[0]![0];
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.fields.name).toBeTruthy();
  });

  it("uses '_' as the field key for a root-level Zod issue with an empty path", () => {
    const reply = makeReply();
    const schema = z.string();
    const result = schema.safeParse(5);
    if (result.success) throw new Error("expected failure");

    errorHandler(result.error, request, reply);

    const payload = reply.send.mock.calls[0]![0];
    expect(payload.error.fields._).toBeTruthy();
  });

  it("maps an unrecognized error to a generic 500 response", () => {
    const reply = makeReply();
    errorHandler(new Error("unexpected"), request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId: "req-1",
      },
    });
  });
});
