-- Days 33-63: end of Ali 'Imran (verse 200), all of An-Nisa (176 verses), into
-- Al-Ma'idah, ending day 63 crossing from Al-Ma'idah:114 into Al-An'am:8.
-- As with days 25-32, several "sampai" (end-verse) cells in this source photo print
-- digits in reversed order (e.g. day 33 shows "841" which reading as 148 is what
-- makes day 34 start at 149, and so on). Reconstructed by reversing those digits
-- and cross-validating day-to-day continuity plus known surah boundaries: day 37
-- ends exactly at Ali 'Imran's last verse (200), matching docs/quran-surah-reference.md.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (33, 3, 133, 3, 148),
  (34, 3, 149, 3, 158),
  (35, 3, 159, 3, 174),
  (36, 3, 175, 3, 186),
  (37, 3, 187, 3, 200),
  (38, 4, 1, 4, 11),
  (39, 4, 12, 4, 19),
  (40, 4, 20, 4, 26),
  (41, 4, 27, 4, 37),
  (42, 4, 38, 4, 51),
  (43, 4, 52, 4, 65),
  (44, 4, 66, 4, 79),
  (45, 4, 80, 4, 91),
  (46, 4, 92, 4, 101),
  (47, 4, 102, 4, 113),
  (48, 4, 114, 4, 127),
  (49, 4, 128, 4, 140),
  (50, 4, 141, 4, 154),
  (51, 4, 155, 4, 170),
  (52, 4, 171, 5, 2),
  (53, 5, 3, 5, 9),
  (54, 5, 10, 5, 17),
  (55, 5, 18, 5, 31),
  (56, 5, 32, 5, 41),
  (57, 5, 42, 5, 50),
  (58, 5, 51, 5, 64),
  (59, 5, 65, 5, 76),
  (60, 5, 77, 5, 89),
  (61, 5, 90, 5, 103),
  (62, 5, 104, 5, 113),
  (63, 5, 114, 6, 8);
