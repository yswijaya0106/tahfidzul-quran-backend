export interface PresignedUpload {
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface ObjectStorage {
  createPresignedUpload(fileName: string, mimeType: string): Promise<PresignedUpload>;
  createSignedDownloadUrl(objectKey: string): Promise<string>;
  headObject(
    objectKey: string,
  ): Promise<{ exists: boolean; sizeBytes: number; mimeType: string } | null>;
}
