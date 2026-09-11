import {
  AssessmentType,
  MemorizationAssessment,
  MemorizationAssessmentRevision,
} from "../entities/assessment";
import { PageRequest, ListResult } from "../../shared/pagination";

export interface AssessmentFilters {
  studentId?: string;
  locationId?: string;
  locationIds?: string[];
  assessmentType?: AssessmentType;
  dateFrom?: string;
  dateTo?: string;
}

export interface AssessmentRepository {
  findById(id: string): Promise<MemorizationAssessment | null>;
  list(filters: AssessmentFilters, page: PageRequest): Promise<ListResult<MemorizationAssessment>>;
  create(assessment: MemorizationAssessment): Promise<void>;
  update(id: string, patch: Partial<MemorizationAssessment>): Promise<void>;
  archive(id: string): Promise<void>;
  addRevision(revision: MemorizationAssessmentRevision): Promise<void>;
  listRevisions(assessmentId: string): Promise<MemorizationAssessmentRevision[]>;
  findLatestForStudent(
    studentId: string,
    assessmentType: AssessmentType,
  ): Promise<MemorizationAssessment | null>;
}
