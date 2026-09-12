import { createPool } from "./pool";
import { pickRandomPhotoUrl } from "./dummyPhotoUrls";

/**
 * One-off backfill: replaces any activity_photos.object_key that isn't
 * already a public http(s) URL (leftover placeholder keys like
 * "activities/seed/<uuid>-0.jpg" from before the dummy-data scripts switched
 * to real Wikimedia photos) with a random verified photo URL, so every
 * seeded "Kegiatan Harian" photo is actually viewable by the app. Safe to
 * run repeatedly — a no-op once there are no more fake keys left.
 * Run once for local development/demo purposes:
 * `npm run backfill:activity-photo-urls`.
 */
async function backfillFakeActivityPhotoUrls(): Promise<void> {
  const pool = createPool();
  try {
    const [rows] = await pool.query<any[]>(
      "SELECT id FROM activity_photos WHERE object_key NOT LIKE 'http%' AND deleted_at IS NULL",
    );
    if (rows.length === 0) {
      console.log("No placeholder object_key values found; nothing to backfill.");
      return;
    }

    for (const row of rows) {
      await pool.query("UPDATE activity_photos SET object_key = ? WHERE id = ?", [
        pickRandomPhotoUrl(),
        row.id,
      ]);
    }

    console.log(`Backfilled ${rows.length} activity_photos with real photo URLs.`);
  } finally {
    await pool.end();
  }
}

backfillFakeActivityPhotoUrls().catch((error) => {
  console.error("Failed to backfill activity photo URLs:", error);
  process.exit(1);
});
