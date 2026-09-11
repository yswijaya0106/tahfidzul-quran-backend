CREATE TABLE activity_photos (
  id CHAR(36) PRIMARY KEY,
  activity_id CHAR(36) NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  caption VARCHAR(500) NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  thumbnail_object_key VARCHAR(512) NULL,
  processing_status ENUM('PENDING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_activity_photos_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
  KEY idx_activity_photos_activity (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
