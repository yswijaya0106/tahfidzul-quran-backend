import { describe, expect, it } from "vitest";
import { FileUseCases } from "../../src/application/files/fileUseCases";

class FakeObjectStorage {
  headResult: { exists: boolean; sizeBytes: number; mimeType: string } | null = {
    exists: true,
    sizeBytes: 1024,
    mimeType: "image/png",
  };
  async createPresignedUpload(fileName: string, mimeType: string) {
    return {
      objectKey: `objects/${fileName}`,
      uploadUrl: `https://upload/${mimeType}`,
      expiresAt: "2026-01-01T00:05:00.000Z",
    };
  }
  async createSignedDownloadUrl(objectKey: string) {
    return `https://download/${objectKey}`;
  }
  async headObject() {
    return this.headResult;
  }
}

function buildUseCase() {
  const storage = new FakeObjectStorage();
  const useCase = new FileUseCases(storage as never);
  return { useCase, storage };
}

describe("FileUseCases", () => {
  it("presigns an upload for an allowed MIME type", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.presign({ fileName: "photo.png", mimeType: "image/png" });
    expect(result.objectKey).toBe("objects/photo.png");
  });

  it("rejects presign for an unsupported MIME type", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.presign({ fileName: "file.exe", mimeType: "application/x-msdownload" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("completes an upload when the object exists and is valid", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.complete({ objectKey: "objects/photo.png" });
    expect(result).toEqual({ objectKey: "objects/photo.png", sizeBytes: 1024 });
  });

  it("rejects complete when the object does not exist", async () => {
    const { useCase, storage } = buildUseCase();
    storage.headResult = null;
    await expect(useCase.complete({ objectKey: "missing" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects complete when the object reports exists: false", async () => {
    const { useCase, storage } = buildUseCase();
    storage.headResult = { exists: false, sizeBytes: 0, mimeType: "image/png" };
    await expect(useCase.complete({ objectKey: "missing" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects complete when the object exceeds the maximum size", async () => {
    const { useCase, storage } = buildUseCase();
    storage.headResult = { exists: true, sizeBytes: 999_999_999, mimeType: "image/png" };
    await expect(useCase.complete({ objectKey: "big" })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects complete when the object has an unsupported MIME type", async () => {
    const { useCase, storage } = buildUseCase();
    storage.headResult = { exists: true, sizeBytes: 100, mimeType: "application/zip" };
    await expect(useCase.complete({ objectKey: "bad" })).rejects.toMatchObject({ status: 400 });
  });
});
