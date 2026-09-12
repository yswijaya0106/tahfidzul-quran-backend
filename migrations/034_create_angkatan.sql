-- Angkatan (intake cohort/batch): groups students admitted together at a
-- specific Rumah Tahfidz over a given period. Scoped per-location, since
-- admission years/batches differ across locations. CRUD is admin-only;
-- reads follow the same location-scoping as other location-owned resources.
CREATE TABLE angkatan (
  id CHAR(36) PRIMARY KEY,
  location_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_angkatan_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_angkatan_location_name (location_id, name),
  KEY idx_angkatan_location (location_id),
  CONSTRAINT chk_angkatan_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
