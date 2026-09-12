-- Tracks when a student began the 300-day tahfidz/tilawah program, so their
-- current program day (and thus expected daily_targets range) can be derived
-- as DATEDIFF(today, program_start_date) + 1. Nullable: existing students and
-- any student without a known start date simply have no target to compare
-- against (surfaced as "no target data" rather than a false negative).
ALTER TABLE students
  ADD COLUMN program_start_date DATE NULL AFTER student_code;
