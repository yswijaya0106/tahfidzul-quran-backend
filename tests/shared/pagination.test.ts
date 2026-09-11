import { describe, expect, it } from "vitest";
import { parsePageRequest, offsetFor } from "../../src/shared/pagination";

describe("parsePageRequest", () => {
  it("defaults to page 1 and pageSize 20", () => {
    expect(parsePageRequest({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("parses string query values", () => {
    expect(parsePageRequest({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("parses numeric query values", () => {
    expect(parsePageRequest({ page: 2, pageSize: 10 })).toEqual({ page: 2, pageSize: 10 });
  });

  it("rejects a non-positive or non-integer page", () => {
    expect(() => parsePageRequest({ page: "0" })).toThrow(/page must be/);
    expect(() => parsePageRequest({ page: "1.5" })).toThrow(/page must be/);
    expect(() => parsePageRequest({ page: "abc" })).toThrow(/page must be/);
  });

  it("rejects a pageSize outside the allowed range", () => {
    expect(() => parsePageRequest({ pageSize: "0" })).toThrow(/pageSize must be/);
    expect(() => parsePageRequest({ pageSize: "101" })).toThrow(/pageSize must be/);
    expect(() => parsePageRequest({ pageSize: "10.5" })).toThrow(/pageSize must be/);
  });
});

describe("offsetFor", () => {
  it("computes the zero-based offset", () => {
    expect(offsetFor({ page: 1, pageSize: 20 })).toBe(0);
    expect(offsetFor({ page: 3, pageSize: 20 })).toBe(40);
  });
});
