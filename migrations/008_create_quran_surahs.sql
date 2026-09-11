CREATE TABLE quran_surahs (
  surah_number TINYINT UNSIGNED PRIMARY KEY,
  arabic_name VARCHAR(50) NOT NULL,
  latin_name VARCHAR(50) NOT NULL,
  verse_count SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT chk_quran_surahs_number CHECK (surah_number BETWEEN 1 AND 114),
  CONSTRAINT chk_quran_surahs_verse_count CHECK (verse_count > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
