-- Days 25-32 (Ali 'Imran 1-132). The source photo's "sampai" (end-verse) column
-- for this block prints digits in reversed order (e.g. day 26 shows "92" where
-- reading it as 29 is what makes day 27 start at 30, and so on through day 32,
-- which must end at verse 132 for day 33 to start at 133 as already confirmed).
-- Reconstructed by reversing those digits and cross-validating day-to-day
-- continuity plus each day's verse count against the established ~10-20/day pace.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (25, 3, 1, 3, 15),
  (26, 3, 16, 3, 29),
  (27, 3, 30, 3, 43),
  (28, 3, 44, 3, 62),
  (29, 3, 63, 3, 77),
  (30, 3, 78, 3, 94),
  (31, 3, 95, 3, 115),
  (32, 3, 116, 3, 132);
