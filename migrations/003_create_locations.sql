CREATE TABLE locations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  phone VARCHAR(32) NULL,
  description TEXT NULL,
  cover_photo_object_key VARCHAR(512) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_locations_status (status),
  KEY idx_locations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
