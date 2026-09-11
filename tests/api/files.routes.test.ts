import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileUseCases } from "../../src/application/files/fileUseCases";
import { setupTestApp, authHeader, TestContext } from "./testHelpers";

class FakeObjectStorage {
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
  async headObject(objectKey: string) {
    if (objectKey === "missing") return null;
    return { exists: true, sizeBytes: 1024, mimeType: "image/png" };
  }
}

let ctx: TestContext;

beforeAll(async () => {
  ctx = await setupTestApp({
    fileUseCases: new FileUseCases(new FakeObjectStorage() as never),
  });
});

afterAll(async () => {
  await ctx.app.close();
  await ctx.pool.end();
});

describe("files routes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/presign",
      payload: { fileName: "photo.png", mimeType: "image/png" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("presigns an upload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/presign",
      headers: authHeader(ctx.adminToken),
      payload: { fileName: "photo.png", mimeType: "image/png" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.objectKey).toBe("objects/photo.png");
  });

  it("rejects presign for an unsupported MIME type", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/presign",
      headers: authHeader(ctx.adminToken),
      payload: { fileName: "file.exe", mimeType: "application/x-msdownload" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("completes an upload", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/objects%2Fphoto.png/complete",
      headers: authHeader(ctx.adminToken),
      payload: { objectKey: "objects/photo.png" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ objectKey: "objects/photo.png", sizeBytes: 1024 });
  });

  it("returns 404 when completing a missing object", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/missing/complete",
      headers: authHeader(ctx.adminToken),
      payload: { objectKey: "missing" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("deduplicates a completion request using the idempotency key", async () => {
    const idempotencyKey = `key-${Date.now()}`;
    const first = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/objects%2Fphoto.png/complete",
      headers: { ...authHeader(ctx.adminToken), "idempotency-key": idempotencyKey },
      payload: { objectKey: "objects/photo.png" },
    });
    const second = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/files/objects%2Fphoto.png/complete",
      headers: { ...authHeader(ctx.adminToken), "idempotency-key": idempotencyKey },
      payload: { objectKey: "objects/photo.png" },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().data).toEqual(first.json().data);
  });
});
