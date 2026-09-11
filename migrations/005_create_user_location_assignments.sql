CREATE TABLE user_location_assignments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  location_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ula_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ula_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  UNIQUE KEY uq_ula_user_location (user_id, location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
