import { describe, expect, it } from "vitest";
import {
  assertAdmin,
  assertLocationScope,
  AuthContext,
} from "../../src/application/authz/authContext";
import { AppError } from "../../src/domain/errors";

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

describe("assertAdmin", () => {
  it("allows admins", () => {
    expect(() => assertAdmin(admin)).not.toThrow();
  });

  it("rejects location operators", () => {
    expect(() => assertAdmin(operator)).toThrow(AppError);
  });
});

describe("assertLocationScope", () => {
  it("allows admins for any location", () => {
    expect(() => assertLocationScope(admin, "location-z")).not.toThrow();
  });

  it("allows an operator to act on an assigned location", () => {
    expect(() => assertLocationScope(operator, "location-a")).not.toThrow();
  });

  it("rejects an operator acting on an unassigned location, without leaking details", () => {
    let thrown: unknown;
    try {
      assertLocationScope(operator, "location-b");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).status).toBe(403);
  });
});
