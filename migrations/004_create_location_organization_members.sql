CREATE TABLE location_organization_members (
  id CHAR(36) PRIMARY KEY,
  location_id CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role_title VARCHAR(150) NOT NULL,
  phone VARCHAR(32) NULL,
  CONSTRAINT fk_lom_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  KEY idx_lom_location (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
