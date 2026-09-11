import { FastifyInstance } from "fastify";
import { z } from "zod";

const surahNumberParams = z.object({ surahNumber: z.coerce.number().int() });

export default async function quranRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/api/v1/quran/surahs", { preHandler: fastify.authenticate }, async () => {
    const surahs = await fastify.container.quranUseCases.list();
    return { data: surahs, meta: { page: 1, pageSize: surahs.length, total: surahs.length } };
  });

  fastify.get(
    "/api/v1/quran/surahs/:surahNumber",
    { preHandler: fastify.authenticate },
    async (request) => {
      const { surahNumber } = surahNumberParams.parse(request.params);
      const surah = await fastify.container.quranUseCases.getBySurahNumber(surahNumber);
      return { data: surah };
    },
  );
}
