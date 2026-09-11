-- Ikhtibar: periodic memorization exam per Juz range (distinct from the
-- surah/verse-level daily memorization_assessments), graded on the same
-- Mumtaz/Jayyid Jiddan/Jayyid/Maqbul/Rasib scale plus a 0-100 numeric score.
CREATE TABLE ikhtibar (
  id CHAR(36) PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  location_id CHAR(36) NOT NULL,
  exam_date DATE NOT NULL,
  juz_from TINYINT UNSIGNED NOT NULL,
  juz_to TINYINT UNSIGNED NOT NULL,
  grade ENUM('MUMTAZ', 'JAYYID_JIDDAN', 'JAYYID', 'MAQBUL', 'RASIB') NOT NULL,
  score DECIMAL(5, 2) NOT NULL,
  notes TEXT NULL,
  assessor_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_ikhtibar_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ikhtibar_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ikhtibar_assessor FOREIGN KEY (assessor_user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_ikhtibar_juz_range CHECK (juz_from BETWEEN 1 AND 30 AND juz_to BETWEEN 1 AND 30 AND juz_to >= juz_from),
  CONSTRAINT chk_ikhtibar_score CHECK (score BETWEEN 0 AND 100),
  KEY idx_ikhtibar_student_date (student_id, exam_date),
  KEY idx_ikhtibar_location (location_id),
  KEY idx_ikhtibar_date (exam_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
