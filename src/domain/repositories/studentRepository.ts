import { Student, StudentDocument, StudentStatus } from "../entities/student";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface StudentFilters {
  name?: string;
  studentCode?: string;
  phone?: string;
  locationId?: string;
  locationIds?: string[];
  angkatanId?: string;
  status?: StudentStatus;
}

export interface StudentRepository {
  findById(id: string): Promise<Student | null>;
  findByStudentCode(studentCode: string): Promise<Student | null>;
  list(filters: StudentFilters, page: PageRequest): Promise<ListResult<Student>>;
  create(student: Student): Promise<void>;
  update(id: string, patch: Partial<Student>): Promise<void>;
  archive(id: string): Promise<void>;
  hasAssessments(studentId: string): Promise<boolean>;
  addDocument(document: StudentDocument): Promise<void>;
  listDocuments(studentId: string): Promise<StudentDocument[]>;
}
