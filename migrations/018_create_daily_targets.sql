-- Reference table: the "Target Tilawah/Tahfidz 300 Hari" schedule (Jam'iyyah Ihsan
-- Tarbiyyah Islamiyyah), mapping each program day (1-300) to the Quran range to be
-- recited/memorized that day. Canonical source: docs/target (photographed pages).
CREATE TABLE daily_targets (
  day_number SMALLINT UNSIGNED PRIMARY KEY,
  start_surah_number TINYINT UNSIGNED NOT NULL,
  start_verse_number SMALLINT UNSIGNED NOT NULL,
  end_surah_number TINYINT UNSIGNED NOT NULL,
  end_verse_number SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT chk_daily_targets_day CHECK (day_number BETWEEN 1 AND 300),
  CONSTRAINT fk_daily_targets_start_surah FOREIGN KEY (start_surah_number) REFERENCES quran_surahs (surah_number),
  CONSTRAINT fk_daily_targets_end_surah FOREIGN KEY (end_surah_number) REFERENCES quran_surahs (surah_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
