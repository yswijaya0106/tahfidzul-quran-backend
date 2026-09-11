import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const idParams = z.object({ id: z.string().uuid() });

function defaultRange(query: Record<string, string>) {
  const to = query.to ?? new Date().toISOString().slice(0, 10);
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 30);
  const from = query.from ?? fromDefault.toISOString().slice(0, 10);
  const timezone = query.timezone ?? "UTC";
  return { range: { from, to }, timezone };
}

export default async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/api/v1/dashboard/locations/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      const { range, timezone } = defaultRange(request.query as Record<string, string>);
      const data = await fastify.container.dashboardUseCases.getLocationDashboard(
        request.auth,
        id,
        range,
        timezone,
      );
      return { data };
    },
  );

  fastify.get(
    "/api/v1/dashboard/students/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      if (!request.auth) throw AppError.unauthenticated();
      const { id } = idParams.parse(request.params);
      const { range, timezone } = defaultRange(request.query as Record<string, string>);
      const data = await fastify.container.dashboardUseCases.getStudentDashboard(
        request.auth,
        id,
        range,
        timezone,
      );
      return { data };
    },
  );
}
