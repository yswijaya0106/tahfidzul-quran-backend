import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    // Isolate tests from the dev/app database: this only sets the var for
    // the vitest process, before config.ts's `dotenv/config` import runs
    // (dotenv never overrides an already-set env var), so `npm run dev` and
    // manual scripts still use DB_NAME from .env untouched.
    env: {
      DB_NAME: "tahfidz_quran_test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/infrastructure/db/seedAdmin.ts",
        "src/presentation/http/types.ts",
        "src/domain/repositories/**",
        "src/domain/entities/activity.ts",
        "src/domain/entities/assessment.ts",
        "src/domain/entities/auditLog.ts",
        "src/domain/entities/quranSurah.ts",
        "src/application/*/ports.ts",
      ],
      thresholds: {
        statements: 98,
        branches: 98,
        functions: 98,
        lines: 98,
      },
    },
  },
});
