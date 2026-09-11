import { describe, expect, it } from "vitest";
import { assertValidCoordinates } from "../../src/domain/entities/location";

describe("assertValidCoordinates", () => {
  it("accepts both omitted", () => {
    expect(() => assertValidCoordinates(null, null)).not.toThrow();
    expect(() => assertValidCoordinates(undefined, undefined)).not.toThrow();
  });

  it("accepts both provided within range", () => {
    expect(() => assertValidCoordinates(-6.2, 106.8)).not.toThrow();
    expect(() => assertValidCoordinates(-90, -180)).not.toThrow();
    expect(() => assertValidCoordinates(90, 180)).not.toThrow();
  });

  it("rejects when only one of latitude/longitude is provided", () => {
    expect(() => assertValidCoordinates(1, null)).toThrow(/must both be provided/);
    expect(() => assertValidCoordinates(null, 1)).toThrow(/must both be provided/);
  });

  it("rejects a latitude outside -90..90", () => {
    expect(() => assertValidCoordinates(91, 0)).toThrow(/latitude must be between/);
    expect(() => assertValidCoordinates(-91, 0)).toThrow(/latitude must be between/);
  });

  it("rejects a longitude outside -180..180", () => {
    expect(() => assertValidCoordinates(0, 181)).toThrow(/longitude must be between/);
    expect(() => assertValidCoordinates(0, -181)).toThrow(/longitude must be between/);
  });
});
