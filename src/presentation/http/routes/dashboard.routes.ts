import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../../domain/errors";

const idParams = z.object({ id: z.string().uuid() });
const overviewQuerySchema = z.object({ date: z.string().date().optional() });
const dailyQuerySchema = z.object({
  date: z.string().date().optional(),
  locationId: z.string().uuid().optional(),
});
const leaderboardQuerySchema = z.object({
  scope: z.enum(["AGGREGATE", "DAILY"]).optional(),
  date: z.string().date().optional(),
  locationId: z.string().uuid().optional(),
});

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
    "/api/v1/dashboard/overview",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { date } = overviewQuerySchema.parse(request.query);
      const data = await fastify.container.dashboardUseCases.getLocationsOverview(
        request.auth,
        date ?? new Date().toISOString().slice(0, 10),
      );
      return { data };
    },
  );

  fastify.get(
    "/api/v1/dashboard/memorization-progress",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { date, locationId } = dailyQuerySchema.parse(request.query);
      const data = await fastify.container.dashboardUseCases.getTodayMemorizationProgress(
        request.auth,
        date ?? new Date().toISOString().slice(0, 10),
        locationId,
      );
      return { data };
    },
  );

  fastify.get(
    "/api/v1/dashboard/leaderboard",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { scope, date, locationId } = leaderboardQuerySchema.parse(request.query);
      const data = await fastify.container.dashboardUseCases.getMemorizationLeaderboard(
        request.auth,
        scope ?? "AGGREGATE",
        date ?? new Date().toISOString().slice(0, 10),
        locationId,
      );
      return { data };
    },
  );

  fastify.get(
    "/api/v1/dashboard/today-activity-photos",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
      if (!request.auth) throw AppError.unauthenticated();
      const { date, locationId } = dailyQuerySchema.parse(request.query);
      const data = await fastify.container.dashboardUseCases.getTodayActivityPhotos(
        request.auth,
        date ?? new Date().toISOString().slice(0, 10),
        locationId,
      );
      return { data };
    },
  );

  fastify.get(
    "/api/v1/dashboard/locations/:id",
    { preHandler: fastify.authenticate },
    async (request) => {
      /* v8 ignore next */
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
      /* v8 ignore next */
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
