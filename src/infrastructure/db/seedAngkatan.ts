import { v4 as uuid } from "uuid";
import { createPool } from "./pool";
import { toSqlDateTime } from "./dateTime";

/**
 * Seeds two intake cohorts ("Angkatan 2025" and "Angkatan 2026") per active
 * real location, then assigns every currently-unassigned active student to
 * one of their location's two cohorts (split evenly), so the new Angkatan
 * CRUD screens and student filters have realistic demo data. Idempotent:
 * skips a location's cohort if one with the same name already exists there,
 * and only touches students with no angkatan_id yet.
 * Run once for local development/demo purposes: `npm run seed:angkatan`.
 */
async function seedAngkatan(): Promise<void> {
  const pool = createPool();
  try {
    const now = toSqlDateTime(new Date().toISOString());
    const [locations] = await pool.query<any[]>(
      "SELECT id, name FROM locations WHERE status = 'ACTIVE' AND deleted_at IS NULL",
    );
    if (locations.length === 0) {
      console.log("No active locations found; nothing to seed.");
      return;
    }

    const cohorts = [
      { name: "Angkatan 2025", startDate: "2025-01-01", endDate: "2025-12-31" },
      { name: "Angkatan 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
    ];

    let createdCohorts = 0;
    let assignedStudents = 0;

    for (const location of locations) {
      const cohortIds: string[] = [];

      for (const cohort of cohorts) {
        const [existingRows] = await pool.query<any[]>(
          "SELECT id FROM angkatan WHERE location_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1",
          [location.id, cohort.name],
        );
        if (existingRows.length > 0) {
          cohortIds.push(existingRows[0].id);
          continue;
        }

        const cohortId = uuid();
        await pool.query(
          `INSERT INTO angkatan (id, location_id, name, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [cohortId, location.id, cohort.name, cohort.startDate, cohort.endDate, now, now],
        );
        cohortIds.push(cohortId);
        createdCohorts += 1;
      }

      const [students] = await pool.query<any[]>(
        `SELECT id FROM students
         WHERE location_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL AND angkatan_id IS NULL
         ORDER BY student_code ASC`,
        [location.id],
      );

      for (const [index, student] of students.entries()) {
        const cohortId = cohortIds[index % cohortIds.length]!;
        await pool.query("UPDATE students SET angkatan_id = ? WHERE id = ?", [
          cohortId,
          student.id,
        ]);
        assignedStudents += 1;
      }

      console.log(
        `"${location.name}": ${cohortIds.length} cohort(s) ready, ${students.length} student(s) assigned.`,
      );
    }

    console.log(
      `\nSeeded ${createdCohorts} new angkatan and assigned ${assignedStudents} students.`,
    );
  } finally {
    await pool.end();
  }
}

seedAngkatan().catch((error) => {
  console.error("Failed to seed angkatan:", error);
  process.exit(1);
});
