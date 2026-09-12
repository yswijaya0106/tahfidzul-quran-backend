import { v4 as uuid } from "uuid";
import { createPool } from "./pool";
import { toSqlDate, toSqlDateTime } from "./dateTime";
import { DUMMY_PHOTO_URLS } from "./dummyPhotoUrls";

const DAYS_AHEAD = 180;
/** Override via SEED_START_DAY/SEED_END_DAY env vars to backfill a narrower
 * range (e.g. just today) without re-seeding days that already have data. */
const START_DAY = process.env.SEED_START_DAY ? Number(process.env.SEED_START_DAY) : 0;
const END_DAY = process.env.SEED_END_DAY ? Number(process.env.SEED_END_DAY) : DAYS_AHEAD;
/** Roughly how many days out of 7 a given location submits an activity. */
const SUBMISSION_CHANCE_PER_DAY = 0.45;
/** Day offset guaranteed to have every location submit, to demo the "all
 * caught up" state on the admin overview. */
const ALL_SUBMITTED_DAY_OFFSET = 45;

const ACTIVITY_TITLES = [
  { title: "Tahsin Bersama", description: "Perbaikan bacaan makhraj dan tajwid." },
  { title: "Kajian Kitab Riyadhus Shalihin", description: "Kajian rutin ba'da Maghrib." },
  { title: "Setoran Hafalan Kelompok", description: "Sesi setoran hafalan bersama pembimbing." },
  { title: "Olahraga Pagi Santri", description: "Senam pagi dan lari santai." },
  { title: "Muhasabah Mingguan", description: "Muhasabah dan motivasi menghafal." },
  { title: "Kajian Akhlak dan Adab", description: "Pembinaan akhlak dan adab sehari-hari." },
  { title: "Praktik Wudhu dan Shalat", description: "Praktik tata cara wudhu dan shalat berjamaah." },
  { title: "Tadabbur Alam", description: "Kegiatan tadabbur alam dan refleksi ayat kauniyah." },
  { title: "Bakti Sosial", description: "Kegiatan bakti sosial bersama warga sekitar." },
  { title: "Lomba Tahfidz Internal", description: "Lomba hafalan antar santri." },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

function pickPhotoUrls(count: number): string[] {
  const shuffled = [...DUMMY_PHOTO_URLS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Seeds random Kegiatan Harian (activities + photos) dated from today through
 * the next 180 days for every active location, mixing days some locations
 * skip with one guaranteed day where every location has submitted — so the
 * admin overview shows both "belum submit" and "semua sudah submit" states.
 * Additive: does not touch existing activities. Photos reference
 * already-public, license-verified Wikimedia Commons URLs directly (no local
 * object storage required — see the passthrough in
 * S3ObjectStorage.createSignedDownloadUrl). Run once for local
 * development/demo purposes: `npm run seed:future-activities`.
 */
async function seedFutureActivities(): Promise<void> {
  const pool = createPool();
  try {
    const [locations] = await pool.query<any[]>(
      "SELECT id FROM locations WHERE status = 'ACTIVE' AND deleted_at IS NULL",
    );
    if (locations.length === 0) {
      console.log("No active locations found; nothing to seed.");
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
    const fallbackCreatorId = adminRows[0]?.id as string | undefined;
    if (!fallbackCreatorId && operatorByLocation.size === 0) {
      throw new Error("No active users found to use as created_by_user_id.");
    }

    const now = toSqlDateTime(new Date().toISOString());
    const today = new Date();
    let totalActivities = 0;
    let totalPhotos = 0;
    const activityRows: unknown[][] = [];
    const photoRows: unknown[][] = [];

    for (const location of locations) {
      const creatorUserId = operatorByLocation.get(location.id) ?? fallbackCreatorId!;

      for (let dayOffset = START_DAY; dayOffset <= END_DAY; dayOffset += 1) {
        const isGuaranteedDay = dayOffset === ALL_SUBMITTED_DAY_OFFSET;
        if (!isGuaranteedDay && Math.random() > SUBMISSION_CHANCE_PER_DAY) continue;

        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + dayOffset);
        const activityDate = toSqlDate(date.toISOString());

        const activityId = uuid();
        const { title, description } = pick(ACTIVITY_TITLES);
        activityRows.push([
          activityId,
          location.id,
          title,
          description,
          activityDate,
          creatorUserId,
          now,
          now,
        ]);
        totalActivities += 1;

        const photoUrls = pickPhotoUrls(randomInt(1, 3));
        photoUrls.forEach((url, index) => {
          photoRows.push([
            uuid(),
            activityId,
            url,
            `${title} - dokumentasi ${index + 1}`,
            index,
            "READY",
            now,
          ]);
          totalPhotos += 1;
        });
      }
    }

    if (activityRows.length > 0) {
      await pool.query(
        `INSERT INTO activities
          (id, location_id, title, description, activity_date, created_by_user_id, created_at, updated_at)
         VALUES ?`,
        [activityRows],
      );
    }
    if (photoRows.length > 0) {
      await pool.query(
        `INSERT INTO activity_photos
          (id, activity_id, object_key, caption, display_order, processing_status, created_at)
         VALUES ?`,
        [photoRows],
      );
    }

    console.log(
      `Seeded ${totalActivities} future activities with ${totalPhotos} photos across ` +
        `${locations.length} locations over the next ${DAYS_AHEAD} days ` +
        `(all locations guaranteed to submit on day +${ALL_SUBMITTED_DAY_OFFSET}).`,
    );
  } finally {
    await pool.end();
  }
}

seedFutureActivities().catch((error) => {
  console.error("Failed to seed future activities:", error);
  process.exit(1);
});
