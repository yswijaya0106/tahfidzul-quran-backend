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
  async getLocationsOverview() {
    return [
      {
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        status: "ACTIVE" as const,
        activeStudentCount: 3,
        assessmentsToday: 1,
        activitiesToday: 0,
        photosToday: 0,
        lastAssessmentAt: null,
        lastActivityAt: null,
      },
    ];
  }
  async getTodayMemorizationProgress() {
    return [
      {
        studentId: "student-reached",
        fullName: "Reached Student",
        studentCode: "TQ-0001",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        assessmentDate: "2026-01-01",
        achievedEndSurahNumber: 2,
        achievedEndVerseNumber: 20,
        dayNumber: 1,
        targetEndSurahNumber: 2,
        targetEndVerseNumber: 16,
      },
      {
        studentId: "student-not-reached",
        fullName: "Not Reached Student",
        studentCode: "TQ-0002",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        assessmentDate: "2026-01-01",
        achievedEndSurahNumber: 1,
        achievedEndVerseNumber: 5,
        dayNumber: 1,
        targetEndSurahNumber: 2,
        targetEndVerseNumber: 16,
      },
      {
        studentId: "student-no-target",
        fullName: "No Target Student",
        studentCode: "TQ-0003",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        assessmentDate: "2026-01-01",
        achievedEndSurahNumber: 5,
        achievedEndVerseNumber: 5,
        dayNumber: null,
        targetEndSurahNumber: null,
        targetEndVerseNumber: null,
      },
    ];
  }
  async getTodayActivityPhotos() {
    return [
      {
        photoId: "photo-1",
        objectKey: "https://example.com/photo-1.jpg",
        caption: "Dokumentasi",
        uploadedAt: "2026-01-01T10:00:00.000Z",
        activityId: "activity-1",
        activityTitle: "Kajian Pagi",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
      },
    ];
  }
  async getAggregateMemorizationProgress() {
    return [
      {
        studentId: "student-ahead",
        fullName: "Ahead Student",
        studentCode: "TQ-0004",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        programStartDate: "2026-01-01",
        latestAssessmentDate: "2026-01-01",
        achievedEndSurahNumber: 2,
        achievedEndVerseNumber: 20,
      },
      {
        studentId: "student-behind",
        fullName: "Behind Student",
        studentCode: "TQ-0005",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        programStartDate: "2026-01-01",
        latestAssessmentDate: "2026-01-01",
        achievedEndSurahNumber: 1,
        achievedEndVerseNumber: 5,
      },
      {
        studentId: "student-no-assessment",
        fullName: "No Assessment Student",
        studentCode: "TQ-0006",
        locationId: "location-a",
        locationName: "Location A",
        kabKota: "Kota A",
        programStartDate: "2026-01-01",
        latestAssessmentDate: null,
        achievedEndSurahNumber: null,
        achievedEndVerseNumber: null,
      },
    ];
  }
}

class FakeDailyTargetRepository {
  async list() {
    return [
      {
        dayNumber: 1,
        startSurahNumber: 1,
        startVerseNumber: 1,
        endSurahNumber: 2,
        endVerseNumber: 16,
      },
    ];
  }
  async findByDayNumber() {
    return null;
  }
  async create() {}
  async update() {}
  async delete() {}
  async hasAssessments() {
    return false;
  }
}

class FakeQuranRepository {
  private readonly surahs = new Map([
    [1, { surahNumber: 1, arabicName: "الفاتحة", latinName: "Al-Fatihah", verseCount: 7 }],
    [2, { surahNumber: 2, arabicName: "البقرة", latinName: "Al-Baqarah", verseCount: 286 }],
  ]);
  getBySurahNumber(n: number) {
    return this.surahs.get(n);
  }
  async getBySurahNumberAsync(n: number) {
    return this.surahs.get(n);
  }
  async list() {
    return Array.from(this.surahs.values());
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

const fakeObjectStorage = {
  createPresignedUpload: async () => ({
    objectKey: "key",
    uploadUrl: "https://example.com/upload",
    expiresAt: "2026-01-01T00:00:00.000Z",
  }),
  createSignedDownloadUrl: async (objectKey: string) => `https://example.com/${objectKey}`,
  headObject: async () => null,
};

function buildUseCase() {
  const dashboards = new FakeDashboardRepository();
  const students = new FakeStudentRepository();
  const useCase = new DashboardUseCases(
    dashboards as never,
    students as never,
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
    fakeObjectStorage as never,
    new FakeDailyTargetRepository() as never,
    new FakeQuranRepository() as never,
  );
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
    programStartDate: null,
    fullName: "Test Student",
    locationId,
    angkatanId: null,
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

  it("returns a locations overview for an admin", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getLocationsOverview(admin, "2026-01-01");
    expect(result.date).toBe("2026-01-01");
    expect(result.data).toEqual([
      expect.objectContaining({ locationId: "location-a", assessmentsToday: 1 }),
    ]);
  });

  it("rejects a locations overview for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.getLocationsOverview(operator, "2026-01-01")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("computes target status for each student's memorization progress", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getTodayMemorizationProgress(admin, "2026-01-01");
    expect(result.date).toBe("2026-01-01");
    expect(result.data).toEqual([
      expect.objectContaining({ studentId: "student-reached", targetStatus: "REACHED" }),
      expect.objectContaining({ studentId: "student-not-reached", targetStatus: "NOT_REACHED" }),
      expect.objectContaining({ studentId: "student-no-target", targetStatus: "NO_TARGET_DATA" }),
    ]);
  });

  it("rejects a memorization progress request for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getTodayMemorizationProgress(operator, "2026-01-01"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("lets a location operator view their own location's memorization progress", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getTodayMemorizationProgress(operator, "2026-01-01", "location-a");
    expect(result.data).toHaveLength(3);
    expect(result.data.every((item) => item.locationId === "location-a")).toBe(true);
  });

  it("rejects a location-scoped memorization progress request for an operator assigned elsewhere", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getTodayMemorizationProgress(operator, "2026-01-01", "location-b"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("resolves signed photo URLs for today's activity photos", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getTodayActivityPhotos(admin, "2026-01-01");
    expect(result.date).toBe("2026-01-01");
    expect(result.data).toEqual([
      expect.objectContaining({
        photoId: "photo-1",
        photoUrl: "https://example.com/https://example.com/photo-1.jpg",
        activityTitle: "Kajian Pagi",
        locationName: "Location A",
      }),
    ]);
  });

  it("rejects a today activity photos request for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.getTodayActivityPhotos(operator, "2026-01-01")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets a location operator view their own location's activity photos", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getTodayActivityPhotos(operator, "2026-01-01", "location-a");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ locationId: "location-a" });
  });

  it("rejects a location-scoped activity photos request for an operator assigned elsewhere", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getTodayActivityPhotos(operator, "2026-01-01", "location-b"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("ranks the daily leaderboard by verse delta, excluding students with no target data", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getMemorizationLeaderboard(admin, "DAILY", "2026-01-01");
    expect(result.scope).toBe("DAILY");
    // student-no-target has dayNumber: null in getTodayMemorizationProgress and is excluded.
    expect(result.data.map((item) => item.studentId)).toEqual([
      "student-reached",
      "student-not-reached",
    ]);
    expect(result.data[0]).toMatchObject({
      rank: 1,
      studentId: "student-reached",
      targetStatus: "REACHED",
    });
    expect(result.data[0]!.deltaVerses).toBeGreaterThan(0);
    expect(result.data[1]).toMatchObject({
      rank: 2,
      studentId: "student-not-reached",
      targetStatus: "NOT_REACHED",
    });
    expect(result.data[1]!.deltaVerses).toBeLessThan(0);
  });

  it("ranks the aggregate leaderboard using each student's furthest position vs their current-day target", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getMemorizationLeaderboard(admin, "AGGREGATE", "2026-01-01");
    expect(result.scope).toBe("AGGREGATE");
    // student-no-assessment has no achieved position and is excluded.
    expect(result.data.map((item) => item.studentId)).toEqual(["student-ahead", "student-behind"]);
    expect(result.data[0]!.deltaVerses).toBeGreaterThan(result.data[1]!.deltaVerses);
  });

  it("defaults to AGGREGATE scope and rejects the leaderboard for a non-admin", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getMemorizationLeaderboard(operator, "AGGREGATE", "2026-01-01"),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets a location operator view their own location's leaderboard", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getMemorizationLeaderboard(
      operator,
      "AGGREGATE",
      "2026-01-01",
      "location-a",
    );
    expect(result.data.map((item) => item.studentId)).toEqual(["student-ahead", "student-behind"]);
    expect(result.data.every((item) => item.locationId === "location-a")).toBe(true);
  });

  it("rejects a location-scoped leaderboard for an operator not assigned to that location", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.getMemorizationLeaderboard(operator, "AGGREGATE", "2026-01-01", "location-b"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("lets an admin view any location's leaderboard", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.getMemorizationLeaderboard(
      admin,
      "DAILY",
      "2026-01-01",
      "location-a",
    );
    expect(result.data.map((item) => item.studentId)).toEqual([
      "student-reached",
      "student-not-reached",
    ]);
  });
});
