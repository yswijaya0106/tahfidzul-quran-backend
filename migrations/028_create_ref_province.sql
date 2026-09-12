-- Reference table: Indonesian provinces. Already present in some deployed
-- databases (added outside the migration system); CREATE TABLE IF NOT EXISTS
-- makes this migration a no-op there while still provisioning it on fresh
-- environments. Uses an integer auto-increment id (not the project's usual
-- UUID convention) to match the pre-existing schema and data.
CREATE TABLE IF NOT EXISTS ref_province (
  id INT(11) NOT NULL AUTO_INCREMENT,
  province_name VARCHAR(30) DEFAULT NULL,
  created_by INT(11) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_by INT(11) DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
