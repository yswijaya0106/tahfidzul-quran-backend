-- Links each student to their intake cohort (nullable: existing students and
-- any student without a known cohort simply have no angkatan assigned).
ALTER TABLE students
  ADD COLUMN angkatan_id CHAR(36) NULL AFTER location_id,
  ADD CONSTRAINT fk_students_angkatan FOREIGN KEY (angkatan_id) REFERENCES angkatan (id),
  ADD KEY idx_students_angkatan (angkatan_id);
