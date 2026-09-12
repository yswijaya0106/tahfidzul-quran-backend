-- Days 257-300: the final block, completing the 300-day schedule from the rest
-- of Al-Fath through An-Nas (the last verse of the Quran). Reads cleanly with no
-- digit-reversal needed, except day 291's end-verse ("47" is impossible for
-- Abasa, which has only 42 verses; corrected to 42, confirmed because day 292
-- starts a fresh surah (At-Takwir:1), which only holds if day 291 ends exactly
-- at Abasa's last verse). This block lands on many known surah-end boundaries in
-- the short final surahs (Al-Hashr 24, As-Saff 14, Al-Inshiqaq 25, At-Takathur 8,
-- and finally day 300 ending at An-Nas 6 - the very last verse of the Quran),
-- all matching docs/quran-surah-reference.md. This completes daily_targets 1-300.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (257, 48, 29, 49, 11),
  (258, 49, 12, 50, 15),
  (259, 50, 16, 51, 6),
  (260, 51, 7, 51, 51),
  (261, 51, 52, 52, 31),
  (262, 52, 32, 53, 26),
  (263, 53, 27, 54, 6),
  (264, 54, 7, 54, 49),
  (265, 54, 50, 55, 40),
  (266, 55, 41, 56, 16),
  (267, 56, 17, 56, 76),
  (268, 56, 77, 57, 11),
  (269, 57, 12, 57, 24),
  (270, 57, 25, 58, 6),
  (271, 58, 7, 58, 21),
  (272, 58, 22, 59, 9),
  (273, 59, 10, 59, 24),
  (274, 60, 1, 60, 11),
  (275, 60, 12, 61, 14),
  (276, 62, 1, 63, 4),
  (277, 63, 5, 64, 9),
  (278, 64, 10, 65, 5),
  (279, 65, 6, 66, 7),
  (280, 66, 8, 67, 12),
  (281, 67, 13, 68, 15),
  (282, 68, 16, 69, 8),
  (283, 69, 9, 70, 10),
  (284, 70, 11, 71, 10),
  (285, 71, 11, 72, 13),
  (286, 72, 14, 73, 19),
  (287, 73, 20, 74, 47),
  (288, 74, 48, 76, 5),
  (289, 76, 6, 77, 19),
  (290, 77, 20, 78, 30),
  (291, 78, 31, 80, 42),
  (292, 81, 1, 83, 6),
  (293, 83, 7, 84, 25),
  (294, 85, 1, 87, 15),
  (295, 87, 16, 89, 23),
  (296, 89, 24, 92, 14),
  (297, 92, 15, 95, 1),
  (298, 95, 2, 98, 7),
  (299, 98, 8, 102, 8),
  (300, 103, 1, 114, 6);
