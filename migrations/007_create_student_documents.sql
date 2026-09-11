CREATE TABLE student_documents (
  id CHAR(36) PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  document_type ENUM('STUDENT_PHOTO', 'ID_CARD', 'GRADUATION_CERTIFICATE') NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_student_documents_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  KEY idx_student_documents_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
