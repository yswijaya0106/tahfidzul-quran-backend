import { v4 as uuid } from "uuid";
import {
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ObjectStorage, PresignedUpload } from "../../application/files/ports";

export interface S3ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3ObjectStorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createPresignedUpload(fileName: string, mimeType: string): Promise<PresignedUpload> {
    const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const objectKey = `uploads/${new Date().toISOString().slice(0, 10)}/${uuid()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.config.signedUrlTtlSeconds,
    });

    const expiresAt = new Date(Date.now() + this.config.signedUrlTtlSeconds * 1000).toISOString();
    return { objectKey, uploadUrl, expiresAt };
  }

  async createSignedDownloadUrl(objectKey: string): Promise<string> {
    // A handful of demo/seed photos reference an already-public URL directly
    // rather than a bucket key (there's nothing to sign for those).
    if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
      return objectKey;
    }
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey });
    return getSignedUrl(this.client, command, { expiresIn: this.config.signedUrlTtlSeconds });
  }

  async headObject(
    objectKey: string,
  ): Promise<{ exists: boolean; sizeBytes: number; mimeType: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
      );
      return {
        exists: true,
        sizeBytes: result.ContentLength ?? 0,
        mimeType: result.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}
