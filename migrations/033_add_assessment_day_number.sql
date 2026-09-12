-- Denormalizes each assessment's program day (1-300) at write time, derived
-- from the student's program_start_date and the assessment's own date, so
-- "hari ke berapa" and progress-vs-target are visible directly on the row
-- without recomputing DATEDIFF on every read. FK'd to daily_targets, which is
-- now fully seeded for all 300 days.
ALTER TABLE memorization_assessments
  ADD COLUMN day_number SMALLINT UNSIGNED NULL AFTER assessment_date,
  ADD CONSTRAINT fk_assessments_day_number FOREIGN KEY (day_number) REFERENCES daily_targets (day_number),
  ADD KEY idx_assessments_day_number (day_number);
