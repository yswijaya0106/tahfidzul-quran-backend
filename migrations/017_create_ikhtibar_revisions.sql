CREATE TABLE ikhtibar_revisions (
  id CHAR(36) PRIMARY KEY,
  ikhtibar_id CHAR(36) NOT NULL,
  changed_by_user_id CHAR(36) NOT NULL,
  change_type ENUM('CREATE', 'UPDATE', 'ARCHIVE') NOT NULL,
  previous_value JSON NULL,
  new_value JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ikhtibar_revisions_ikhtibar FOREIGN KEY (ikhtibar_id) REFERENCES ikhtibar (id) ON DELETE CASCADE,
  CONSTRAINT fk_ikhtibar_revisions_user FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_ikhtibar_revisions_ikhtibar (ikhtibar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
