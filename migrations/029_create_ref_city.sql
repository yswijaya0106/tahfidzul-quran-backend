-- Reference table: Indonesian regencies/cities (kabupaten/kota), FK'd to
-- ref_province. Already present in some deployed databases (added outside the
-- migration system); CREATE TABLE IF NOT EXISTS makes this migration a no-op
-- there while still provisioning it on fresh environments.
CREATE TABLE IF NOT EXISTS ref_city (
  id INT(10) NOT NULL AUTO_INCREMENT,
  city_name VARCHAR(30) DEFAULT NULL,
  images VARCHAR(200) DEFAULT NULL,
  province_id INT(10) DEFAULT NULL,
  created_by INT(11) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_by INT(11) DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ref_city_province_id (province_id),
  CONSTRAINT fk_ref_city_province FOREIGN KEY (province_id) REFERENCES ref_province (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
