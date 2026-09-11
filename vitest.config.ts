import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
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
