import { AppError } from "../../domain/errors";
import { ObjectStorage, PresignedUpload } from "./ports";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

export interface PresignInput {
  fileName: string;
  mimeType: string;
}

export interface CompleteFileInput {
  objectKey: string;
}

export class FileUseCases {
  constructor(private readonly storage: ObjectStorage) {}

  async presign(input: PresignInput): Promise<PresignedUpload> {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw AppError.validation(`Unsupported MIME type: ${input.mimeType}.`, {
        mimeType: "Unsupported MIME type.",
      });
    }
    return this.storage.createPresignedUpload(input.fileName, input.mimeType);
  }

  async complete(input: CompleteFileInput): Promise<{ objectKey: string; sizeBytes: number }> {
    const meta = await this.storage.headObject(input.objectKey);
    if (!meta || !meta.exists) {
      throw AppError.notFound("The uploaded object was not found in storage.");
    }
    if (meta.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw AppError.validation("Uploaded file exceeds the maximum allowed size.");
    }
    if (!ALLOWED_MIME_TYPES.has(meta.mimeType)) {
      throw AppError.validation(`Unsupported MIME type: ${meta.mimeType}.`);
    }
    return { objectKey: input.objectKey, sizeBytes: meta.sizeBytes };
  }
}
