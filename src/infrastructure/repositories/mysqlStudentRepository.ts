import { Pool, RowDataPacket } from "mysql2/promise";
import { StudentRepository, StudentFilters } from "../../domain/repositories/studentRepository";
import { Student, StudentDocument } from "../../domain/entities/student";
import { ListResult, PageRequest, offsetFor } from "../../shared/pagination";
import { toSqlDateTime } from "../db/dateTime";

interface StudentRow extends RowDataPacket {
  id: string;
  student_code: string;
  full_name: string;
  location_id: string;
  nik_encrypted: string | null;
  guardian_name: string | null;
  address: string | null;
  student_phone: string | null;
  guardian_phone: string | null;
  student_photo_object_key: string | null;
  id_card_photo_object_key: string | null;
  graduation_certificate_object_key: string | null;
  status: "ACTIVE" | "ARCHIVED";
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface DocumentRow extends RowDataPacket {
  id: string;
  student_id: string;
  document_type: "STUDENT_PHOTO" | "ID_CARD" | "GRADUATION_CERTIFICATE";
  object_key: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
  deleted_at: Date | null;
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    studentCode: row.student_code,
    fullName: row.full_name,
    locationId: row.location_id,
    nikEncrypted: row.nik_encrypted,
    guardianName: row.guardian_name,
    address: row.address,
    studentPhone: row.student_phone,
    guardianPhone: row.guardian_phone,
    studentPhotoObjectKey: row.student_photo_object_key,
    idCardPhotoObjectKey: row.id_card_photo_object_key,
    graduationCertificateObjectKey: row.graduation_certificate_object_key,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapDocument(row: DocumentRow): StudentDocument {
  return {
    id: row.id,
    studentId: row.student_id,
    documentType: row.document_type,
    objectKey: row.object_key,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export class MysqlStudentRepository implements StudentRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Student | null> {
    const [rows] = await this.pool.query<StudentRow[]>("SELECT * FROM students WHERE id = ?", [id]);
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  async findByStudentCode(studentCode: string): Promise<Student | null> {
    const [rows] = await this.pool.query<StudentRow[]>(
      "SELECT * FROM students WHERE student_code = ?",
      [studentCode],
    );
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  async list(filters: StudentFilters, page: PageRequest): Promise<ListResult<Student>> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.name) {
      conditions.push("full_name LIKE ?");
      params.push(`%${filters.name}%`);
    }
    if (filters.studentCode) {
      conditions.push("student_code LIKE ?");
      params.push(`%${filters.studentCode}%`);
    }
    if (filters.phone) {
      conditions.push("(student_phone LIKE ? OR guardian_phone LIKE ?)");
      params.push(`%${filters.phone}%`, `%${filters.phone}%`);
    }
    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.locationId) {
      conditions.push("location_id = ?");
      params.push(filters.locationId);
    }
    if (filters.locationIds) {
      if (filters.locationIds.length === 0) {
        return { data: [], meta: { page: page.page, pageSize: page.pageSize, total: 0 } };
      }
      conditions.push(`location_id IN (${filters.locationIds.map(() => "?").join(",")})`);
      params.push(...filters.locationIds);
    }

    const whereClause = conditions.join(" AND ");
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM students WHERE ${whereClause}`,
      params,
    );
    const total = Number((countRows[0] as { total: number }).total);

    const [rows] = await this.pool.query<StudentRow[]>(
      `SELECT * FROM students WHERE ${whereClause} ORDER BY full_name ASC LIMIT ? OFFSET ?`,
      [...params, page.pageSize, offsetFor(page)],
    );

    return {
      data: rows.map(mapStudent),
      meta: { page: page.page, pageSize: page.pageSize, total },
    };
  }

  async create(student: Student): Promise<void> {
    await this.pool.query(
      `INSERT INTO students
        (id, student_code, full_name, location_id, nik_encrypted, guardian_name, address,
         student_phone, guardian_phone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.id,
        student.studentCode,
        student.fullName,
        student.locationId,
        student.nikEncrypted,
        student.guardianName,
        student.address,
        student.studentPhone,
        student.guardianPhone,
        student.status,
        toSqlDateTime(student.createdAt),
        toSqlDateTime(student.updatedAt),
      ],
    );
  }

  async update(id: string, patch: Partial<Student>): Promise<void> {
    const columnMap: Record<string, unknown> = {
      full_name: patch.fullName,
      nik_encrypted: patch.nikEncrypted,
      guardian_name: patch.guardianName,
      address: patch.address,
      student_phone: patch.studentPhone,
      guardian_phone: patch.guardianPhone,
      student_photo_object_key: patch.studentPhotoObjectKey,
      id_card_photo_object_key: patch.idCardPhotoObjectKey,
      graduation_certificate_object_key: patch.graduationCertificateObjectKey,
      status: patch.status,
      updated_at: patch.updatedAt !== undefined ? toSqlDateTime(patch.updatedAt) : undefined,
      deleted_at:
        patch.deletedAt !== undefined
          ? patch.deletedAt === null
            ? null
            : toSqlDateTime(patch.deletedAt)
          : undefined,
    };

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (fields.length === 0) return;
    params.push(id);
    await this.pool.query(`UPDATE students SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  async archive(id: string): Promise<void> {
    await this.pool.query(
      "UPDATE students SET status = 'ARCHIVED', deleted_at = NOW() WHERE id = ?",
      [id],
    );
  }

  async hasAssessments(studentId: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM memorization_assessments WHERE student_id = ? LIMIT 1",
      [studentId],
    );
    return rows.length > 0;
  }

  async addDocument(document: StudentDocument): Promise<void> {
    await this.pool.query(
      `INSERT INTO student_documents
        (id, student_id, document_type, object_key, original_file_name, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        document.id,
        document.studentId,
        document.documentType,
        document.objectKey,
        document.originalFileName,
        document.mimeType,
        document.sizeBytes,
        toSqlDateTime(document.createdAt),
      ],
    );
  }

  async listDocuments(studentId: string): Promise<StudentDocument[]> {
    const [rows] = await this.pool.query<DocumentRow[]>(
      "SELECT * FROM student_documents WHERE student_id = ? AND deleted_at IS NULL",
      [studentId],
    );
    return rows.map(mapDocument);
  }
}
