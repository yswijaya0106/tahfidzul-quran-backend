-- Days 169-212: rest of Al-Hajj, Al-Mu'minun, An-Nur, Al-Furqan, Ash-Shu'ara,
-- An-Naml, Al-Qasas, Al-Ankabut, Ar-Rum, Luqman, As-Sajdah, into Al-Ahzab.
-- Reads cleanly with no digit-reversal needed; day 169 continues exactly from
-- the already-seeded day 168 (Al-Hajj:55), and this block lands exactly on four
-- known surah-end boundaries: day 182 ends Al-Furqan (77), day 187 ends
-- Ash-Shu'ara (227), day 204 ends Ar-Rum (60), day 206 ends Luqman (34) - all
-- matching docs/quran-surah-reference.md.
INSERT INTO daily_targets
  (day_number, start_surah_number, start_verse_number, end_surah_number, end_verse_number)
VALUES
  (169, 22, 56, 22, 72),
  (170, 22, 73, 23, 17),
  (171, 23, 18, 23, 42),
  (172, 23, 43, 23, 73),
  (173, 23, 74, 23, 104),
  (174, 23, 105, 24, 10),
  (175, 24, 11, 24, 27),
  (176, 24, 28, 24, 36),
  (177, 24, 37, 24, 53),
  (178, 24, 54, 24, 61),
  (179, 24, 62, 25, 11),
  (180, 25, 12, 25, 32),
  (181, 25, 33, 25, 55),
  (182, 25, 56, 25, 77),
  (183, 26, 1, 26, 39),
  (184, 26, 40, 26, 83),
  (185, 26, 84, 26, 136),
  (186, 26, 137, 26, 183),
  (187, 26, 184, 26, 227),
  (188, 27, 1, 27, 22),
  (189, 27, 23, 27, 44),
  (190, 27, 45, 27, 63),
  (191, 27, 64, 27, 88),
  (192, 27, 89, 28, 13),
  (193, 28, 14, 28, 28),
  (194, 28, 29, 28, 43),
  (195, 28, 44, 28, 59),
  (196, 28, 60, 28, 77),
  (197, 28, 78, 29, 6),
  (198, 29, 7, 29, 23),
  (199, 29, 24, 29, 38),
  (200, 29, 39, 29, 52),
  (201, 29, 53, 30, 5),
  (202, 30, 6, 30, 24),
  (203, 30, 25, 30, 41),
  (204, 30, 42, 30, 60),
  (205, 31, 1, 31, 19),
  (206, 31, 20, 31, 34),
  (207, 32, 1, 32, 20),
  (208, 32, 21, 33, 6),
  (209, 33, 7, 33, 22),
  (210, 33, 23, 33, 35),
  (211, 33, 36, 33, 50),
  (212, 33, 51, 33, 62);
