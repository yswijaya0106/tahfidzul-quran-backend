import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../../../domain/errors";

async function authenticatePlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest("auth", undefined);

  fastify.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
      const header = request.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        throw AppError.unauthenticated("A bearer access token is required.");
      }

      const token = header.slice("Bearer ".length);
      const payload = fastify.container.tokenService.verifyAccessToken(token);
      const assignedLocationIds =
        payload.role === "LOCATION_OPERATOR"
          ? await fastify.container.userRepository.getAssignedLocationIds(payload.sub)
          : [];

      request.auth = {
        userId: payload.sub,
        role: payload.role,
        assignedLocationIds,
      };
    },
  );
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authenticatePlugin);
