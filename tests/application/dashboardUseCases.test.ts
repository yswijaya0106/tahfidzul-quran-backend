import { describe, expect, it } from "vitest";
import { DashboardUseCases } from "../../src/application/dashboard/dashboardUseCases";
import { AuthContext } from "../../src/application/authz/authContext";
import { Student } from "../../src/domain/entities/student";

class FakeDashboardRepository {
  async getLocationDashboard() {
    return { activeStudents: 5, recentActivities: [] };
  }
  async getStudentDashboard() {
    return { latestAssessments: [] };
  }
}

class FakeStudentRepository {
  students: Student[] = [];
  async findById(id: string) {
    return this.students.find((s) => s.id === id) ?? null;
  }
  async findByStudentCode() {
    return null;
  }
  async list() {
    return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  }
  async create() {}
  async update() {}
  async archive() {}
  async hasAssessments() {
    return false;
  }
  async addDocument() {}
  async listDocuments() {
    return [];
  }
}

function buildUseCase() {
  const dashboards = new FakeDashboardRepository();
  const students = new FakeStudentRepository();
  const useCase = new DashboardUseCases(dashboards as never, students as never, {
    nowIso: () => "2026-01-01T00:00:00.000Z",
  });
  return { useCase, students };
}

const admin: AuthContext = { userId: "admin-1", role: "ADMIN", assignedLocationIds: [] };
const operator: AuthContext = {
  userId: "operator-1",
  role: "LOCATION_OPERATOR",
  assignedLocationIds: ["location-a"],
};

const range = { from: "2026-01-01", to: "2026-01-31" };

function makeStudent(id: string, locationId = "location-a"): Student {
  return {
    id,
    studentCode: "TQ-0001",
    fullName: "Test Student",
    locationId,
    nikEncrypted: null,
    guardianName: null,
    address: null,
    studentPhone: null,
    guardianPhone: null,
    studentPhotoObjectKey: null,
    idCardPhotoObjectKey: null,
    graduationCertificateObjectKey: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("DashboardUseCases", () => {
  it("returns a location dashboard envelope for an admin", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getLocationDashboard(admin, "location-a", range, "Asia/Jakarta");
    expect(result.range).toEqual(range);
    expect(result.timezone).toBe("Asia/Jakarta");
    expect(result.data).toMatchObject({ activeStudents: 5 });
  });

  it("accepts a custom inactivity threshold", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getLocationDashboard(
      admin,
      "location-a",
      range,
      "Asia/Jakarta",
      30,
    );
    expect(result.lastUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects a location dashboard for an operator outside the location scope", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getLocationDashboard(operator, "location-b", range, "Asia/Jakarta"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns a student dashboard envelope", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1"));
    const result = await useCase.getStudentDashboard(admin, "s1", range, "Asia/Jakarta");
    expect(result.data).toMatchObject({ latestAssessments: [] });
  });

  it("throws not found for a missing or deleted student", async () => {
    const { useCase, students } = buildUseCase();
    await expect(
      useCase.getStudentDashboard(admin, "missing", range, "Asia/Jakarta"),
    ).rejects.toMatchObject({ status: 404 });

    students.students.push({ ...makeStudent("s2"), deletedAt: "2026-01-01T00:00:00.000Z" });
    await expect(
      useCase.getStudentDashboard(admin, "s2", range, "Asia/Jakarta"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a student dashboard for an operator outside the location scope", async () => {
    const { useCase, students } = buildUseCase();
    students.students.push(makeStudent("s1", "location-b"));
    await expect(
      useCase.getStudentDashboard(operator, "s1", range, "Asia/Jakarta"),
    ).rejects.toMatchObject({ status: 403 });
  });
});
