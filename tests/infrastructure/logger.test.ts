import { describe, expect, it } from "vitest";
import { transportFor } from "../../src/infrastructure/logging/logger";

describe("transportFor", () => {
  it("returns a pino-pretty transport for development", () => {
    expect(transportFor("development")).toEqual({
      target: "pino-pretty",
      options: { colorize: true },
    });
  });

  it("returns undefined for non-development environments", () => {
    expect(transportFor("production")).toBeUndefined();
    expect(transportFor("test")).toBeUndefined();
  });
});
