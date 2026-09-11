import { buildApp } from "./presentation/http/app";
import { config } from "./infrastructure/config";

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
