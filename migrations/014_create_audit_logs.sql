CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id CHAR(36) NOT NULL,
  context JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
  KEY idx_audit_logs_resource (resource_type, resource_id),
  KEY idx_audit_logs_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
