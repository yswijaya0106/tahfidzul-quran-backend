import { v4 as uuid } from "uuid";
import { createPool } from "./pool";
import { toSqlDate, toSqlDateTime } from "./dateTime";
import { computeDayNumber } from "../../domain/entities/dailyTarget";

const GRADES = ["MUMTAZ", "JAYYID_JIDDAN", "JAYYID", "MAQBUL", "RASIB"] as const;
const DAYS_AHEAD = 180;
/** Override via SEED_START_DAY/SEED_END_DAY env vars to backfill a narrower
 * range (e.g. just today) without re-seeding days that already have data. */
const START_DAY = process.env.SEED_START_DAY ? Number(process.env.SEED_START_DAY) : 0;
const END_DAY = process.env.SEED_END_DAY ? Number(process.env.SEED_END_DAY) : DAYS_AHEAD;
/** Roughly how many days out of 7 get an assessment for a given student. */
const ASSESSMENT_CHANCE_PER_DAY = 0.4;
const NEW_MEMORIZATION_SHARE = 0.65;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

interface SurahInfo {
  surahNumber: number;
  verseCount: number;
}

interface Position {
  surahNumber: number;
  verseNumber: number;
}

/** Advances a Quran position forward by a random number of verses, crossing
 * surah boundaries using each surah's real verse count, capped at surah 114. */
function advance(position: Position, surahs: SurahInfo[], verses: number): Position {
  let { surahNumber, verseNumber } = position;
  let remaining = verses;
  while (remaining > 0 && surahNumber < 114) {
    const surah = surahs.find((s) => s.surahNumber === surahNumber)!;
    const versesLeftInSurah = surah.verseCount - verseNumber;
    if (remaining <= versesLeftInSurah) {
      verseNumber += remaining;
      remaining = 0;
    } else {
      remaining -= versesLeftInSurah + 1;
      surahNumber += 1;
      verseNumber = 1;
    }
  }
  if (surahNumber >= 114) {
    surahNumber = 114;
    const lastSurah = surahs.find((s) => s.surahNumber === 114)!;
    verseNumber = Math.min(verseNumber, lastSurah.verseCount);
  }
  return { surahNumber, verseNumber };
}

/**
 * Seeds random memorization_assessments dated from today through the next 180
 * days (~6 months) for every currently active student, so calendar/history
 * views have forward-looking demo data. Additive: does not touch existing
 * assessments. Run once for local development/demo purposes:
 * `npm run seed:future-assessments`.
 */
async function seedFutureAssessments(): Promise<void> {
  const pool = createPool();
  try {
    const [students] = await pool.query<any[]>(
      "SELECT id, location_id, program_start_date FROM students WHERE status = 'ACTIVE' AND deleted_at IS NULL",
    );
    if (students.length === 0) {
      console.log("No active students found; nothing to seed.");
      return;
    }

    const [operatorRows] = await pool.query<any[]>(
      `SELECT ula.location_id, u.id AS user_id
       FROM user_location_assignments ula
       JOIN users u ON u.id = ula.user_id
       WHERE u.role = 'LOCATION_OPERATOR' AND u.is_active = 1`,
    );
    const operatorByLocation = new Map<string, string>();
    for (const row of operatorRows) operatorByLocation.set(row.location_id, row.user_id);

    const [adminRows] = await pool.query<any[]>(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1 LIMIT 1",
    );
    const fallbackAssessorId = adminRows[0]?.id as string | undefined;
    if (!fallbackAssessorId && operatorByLocation.size === 0) {
      throw new Error("No active users found to use as assessor_user_id.");
    }

    const [surahRows] = await pool.query<any[]>(
      "SELECT surah_number, verse_count FROM quran_surahs ORDER BY surah_number ASC",
    );
    const surahs: SurahInfo[] = surahRows.map((row) => ({
      surahNumber: row.surah_number,
      verseCount: row.verse_count,
    }));

    const now = toSqlDateTime(new Date().toISOString());
    const today = new Date();
    let totalInserted = 0;

    for (const student of students) {
      const assessorUserId = operatorByLocation.get(student.location_id) ?? fallbackAssessorId!;
      const programStartDate: string | null = student.program_start_date
        ? toSqlDate(student.program_start_date.toISOString())
        : null;
      let position: Position = { surahNumber: randomInt(1, 5), verseNumber: 1 };
      const values: unknown[][] = [];

      for (let dayOffset = START_DAY; dayOffset <= END_DAY; dayOffset += 1) {
        if (Math.random() > ASSESSMENT_CHANCE_PER_DAY) continue;

        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + dayOffset);
        const assessmentDate = toSqlDate(date.toISOString());

        const isNewMemorization = Math.random() < NEW_MEMORIZATION_SHARE;
        let start: Position;
        let end: Position;

        if (isNewMemorization) {
          start = { ...position };
          end = advance(position, surahs, randomInt(3, 15));
          position = end;
        } else {
          // Murojaah revises a short range already covered, starting anywhere
          // from the beginning of the Quran up to the current position.
          const revisionStartSurah = randomInt(1, position.surahNumber);
          start = { surahNumber: revisionStartSurah, verseNumber: 1 };
          end = advance(start, surahs, randomInt(3, 10));
        }

        values.push([
          uuid(),
          student.id,
          student.location_id,
          assessmentDate,
          computeDayNumber(assessmentDate, programStartDate),
          isNewMemorization ? "NEW_MEMORIZATION" : "MUROJAAH",
          start.surahNumber,
          start.verseNumber,
          end.surahNumber,
          end.verseNumber,
          pick(GRADES),
          null,
          assessorUserId,
          now,
          now,
        ]);
      }

      if (values.length === 0) continue;
      await pool.query(
        `INSERT INTO memorization_assessments
          (id, student_id, location_id, assessment_date, day_number, assessment_type,
           start_surah_number, start_verse_number, end_surah_number, end_verse_number,
           grade, notes, assessor_user_id, created_at, updated_at)
         VALUES ?`,
        [values],
      );
      totalInserted += values.length;
    }

    console.log(
      `Seeded ${totalInserted} future memorization_assessments across ${students.length} students ` +
        `over the next ${DAYS_AHEAD} days.`,
    );
  } finally {
    await pool.end();
  }
}

seedFutureAssessments().catch((error) => {
  console.error("Failed to seed future assessments:", error);
  process.exit(1);
});
