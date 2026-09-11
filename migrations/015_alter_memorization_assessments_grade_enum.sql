-- Replaces the NEEDS_REVIEW grade with the standard tahfidz scale used
-- across daily assessments and Ikhtibar: Mumtaz, Jayyid Jiddan, Jayyid,
-- Maqbul, Rasib.
UPDATE memorization_assessments SET grade = 'JAYYID' WHERE grade = 'NEEDS_REVIEW';

ALTER TABLE memorization_assessments
  MODIFY COLUMN grade ENUM('MUMTAZ', 'JAYYID_JIDDAN', 'JAYYID', 'MAQBUL', 'RASIB') NOT NULL;
