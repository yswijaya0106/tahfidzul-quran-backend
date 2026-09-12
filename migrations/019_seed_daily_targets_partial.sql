-- Partial seed: only days 1-24 (Al-Fatihah through the end of Al-Baqarah) have been
-- transcribed and cross-validated from docs/target so far (each day's end verse
-- lines up exactly with the next day's start verse, and day 24 ends precisely at
-- Al-Baqarah's 286th verse). Days 25-300 are pending clearer source photos before
-- they can be transcribed accurately and added in a follow-up migration.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (1, 1, 1, 2, 16),
  (2, 2, 17, 2, 29),
  (3, 2, 30, 2, 48),
  (4, 2, 49, 2, 61),
  (5, 2, 62, 2, 74),
  (6, 2, 75, 2, 88),
  (7, 2, 89, 2, 101),
  (8, 2, 102, 2, 112),
  (9, 2, 113, 2, 123),
  (10, 2, 124, 2, 141),
  (11, 2, 142, 2, 152),
  (12, 2, 153, 2, 169),
  (13, 2, 170, 2, 182),
  (14, 2, 183, 2, 189),
  (15, 2, 190, 2, 202),
  (16, 2, 203, 2, 215),
  (17, 2, 216, 2, 224),
  (18, 2, 225, 2, 233),
  (19, 2, 234, 2, 245),
  (20, 2, 246, 2, 252),
  (21, 2, 253, 2, 259),
  (22, 2, 260, 2, 269),
  (23, 2, 270, 2, 281),
  (24, 2, 282, 2, 286);
