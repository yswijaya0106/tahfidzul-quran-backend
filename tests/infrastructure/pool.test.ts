import { describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../src/infrastructure/db/pool";

function makeFakePool() {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  const pool = {
    getConnection: vi.fn().mockResolvedValue(connection),
  };
  return { pool, connection };
}

describe("withTransaction", () => {
  it("commits and releases the connection when the work succeeds", async () => {
    const { pool, connection } = makeFakePool();
    const result = await withTransaction(pool as never, async () => "ok");

    expect(result).toBe("ok");
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the connection when the work throws", async () => {
    const { pool, connection } = makeFakePool();
    const error = new Error("boom");

    await expect(
      withTransaction(pool as never, async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
