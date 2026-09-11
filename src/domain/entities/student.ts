export type StudentStatus = "ACTIVE" | "ARCHIVED";

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  locationId: string;
  nikEncrypted: string | null;
  guardianName: string | null;
  address: string | null;
  studentPhone: string | null;
  guardianPhone: string | null;
  studentPhotoObjectKey: string | null;
  idCardPhotoObjectKey: string | null;
  graduationCertificateObjectKey: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type StudentDocumentType = "STUDENT_PHOTO" | "ID_CARD" | "GRADUATION_CERTIFICATE";

export interface StudentDocument {
  id: string;
  studentId: string;
  documentType: StudentDocumentType;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  deletedAt: string | null;
}

/** Masks a NIK for list responses; only the last 4 digits remain visible. */
export function maskNik(nikPlain: string | null): string | null {
  if (!nikPlain) return null;
  const visible = nikPlain.slice(-4);
  return `${"*".repeat(Math.max(nikPlain.length - 4, 0))}${visible}`;
}
