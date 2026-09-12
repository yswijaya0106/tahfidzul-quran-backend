import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = sendMock;
  }
  class FakeCommand {
    constructor(public input: unknown) {}
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: FakeCommand,
    GetObjectCommand: FakeCommand,
    HeadObjectCommand: FakeCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { S3ObjectStorage } from "../../src/infrastructure/storage/s3ObjectStorage";

const config = {
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  bucket: "test-bucket",
  accessKeyId: "key",
  secretAccessKey: "secret",
  forcePathStyle: true,
  signedUrlTtlSeconds: 300,
};

describe("S3ObjectStorage", () => {
  beforeEach(() => {
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
  });

  it("creates a presigned upload with an extension-preserving object key", async () => {
    getSignedUrlMock.mockResolvedValue("https://upload-url");
    const storage = new S3ObjectStorage(config);
    const result = await storage.createPresignedUpload("photo.jpg", "image/jpeg");
    expect(result.uploadUrl).toBe("https://upload-url");
    expect(result.objectKey).toMatch(/^uploads\/\d{4}-\d{2}-\d{2}\/.+\.jpg$/);
  });

  it("creates a presigned upload without an extension when the file name has none", async () => {
    getSignedUrlMock.mockResolvedValue("https://upload-url");
    const storage = new S3ObjectStorage(config);
    const result = await storage.createPresignedUpload("noext", "image/jpeg");
    expect(result.objectKey).not.toContain(".");
  });

  it("creates a signed download url", async () => {
    getSignedUrlMock.mockResolvedValue("https://download-url");
    const storage = new S3ObjectStorage(config);
    const url = await storage.createSignedDownloadUrl("objects/1.jpg");
    expect(url).toBe("https://download-url");
  });

  it("returns an already-public URL as-is instead of signing it", async () => {
    const storage = new S3ObjectStorage(config);
    const url = await storage.createSignedDownloadUrl("https://example.com/photo.jpg");
    expect(url).toBe("https://example.com/photo.jpg");
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("returns object metadata when headObject succeeds", async () => {
    sendMock.mockResolvedValue({ ContentLength: 2048, ContentType: "image/png" });
    const storage = new S3ObjectStorage(config);
    const meta = await storage.headObject("objects/1.png");
    expect(meta).toEqual({ exists: true, sizeBytes: 2048, mimeType: "image/png" });
  });

  it("defaults size and mime type when missing from the response", async () => {
    sendMock.mockResolvedValue({});
    const storage = new S3ObjectStorage(config);
    const meta = await storage.headObject("objects/1.png");
    expect(meta).toEqual({ exists: true, sizeBytes: 0, mimeType: "application/octet-stream" });
  });

  it("returns null when headObject throws (object not found)", async () => {
    sendMock.mockRejectedValue(new Error("NotFound"));
    const storage = new S3ObjectStorage(config);
    const meta = await storage.headObject("missing");
    expect(meta).toBeNull();
  });
});
