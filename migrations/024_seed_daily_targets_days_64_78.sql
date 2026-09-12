-- Days 64-78: fills the previously-flagged gap in Al-An'am, ending exactly where
-- the already-seeded day 79 begins (Al-A'raf:68), which independently confirms
-- this reconstruction. A few single-digit misreads in the source photo (last
-- digit off by one, e.g. "90" vs "91", "103" vs "102", "129" vs "119") were
-- corrected via day-to-day continuity; day 74 lands exactly at Al-An'am's last
-- verse (165), matching docs/quran-surah-reference.md.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (64, 6, 9, 6, 26),
  (65, 6, 27, 6, 44),
  (66, 6, 45, 6, 59),
  (67, 6, 60, 6, 73),
  (68, 6, 74, 6, 91),
  (69, 6, 92, 6, 101),
  (70, 6, 102, 6, 118),
  (71, 6, 119, 6, 131),
  (72, 6, 132, 6, 142),
  (73, 6, 143, 6, 151),
  (74, 6, 152, 6, 165),
  (75, 7, 1, 7, 22),
  (76, 7, 23, 7, 37),
  (77, 7, 38, 7, 51),
  (78, 7, 52, 7, 67);
