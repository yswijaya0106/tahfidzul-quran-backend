import { describe, expect, it } from "vitest";
import { AesFieldEncryptor } from "../../src/infrastructure/auth/aesFieldEncryptor";

const key = "0".repeat(64);

describe("AesFieldEncryptor", () => {
  it("round-trips plain text through encrypt/decrypt", () => {
    const encryptor = new AesFieldEncryptor(key);
    const cipherText = encryptor.encrypt("3271010101900001");
    expect(cipherText).not.toContain("3271010101900001");
    expect(encryptor.decrypt(cipherText)).toBe("3271010101900001");
  });

  it("produces a different ciphertext for the same plaintext (random IV)", () => {
    const encryptor = new AesFieldEncryptor(key);
    const a = encryptor.encrypt("value");
    const b = encryptor.encrypt("value");
    expect(a).not.toBe(b);
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => new AesFieldEncryptor("00")).toThrow(/32 bytes/);
  });

  it("rejects a malformed encrypted value", () => {
    const encryptor = new AesFieldEncryptor(key);
    expect(() => encryptor.decrypt("not-a-valid-value")).toThrow(/Malformed/);
  });

  it("rejects a tampered ciphertext (auth tag mismatch)", () => {
    const encryptor = new AesFieldEncryptor(key);
    const cipherText = encryptor.encrypt("value");
    const [iv, authTag, data] = cipherText.split(":");
    const tampered = [iv, authTag, `${data!.slice(0, -2)}ff`].join(":");
    expect(() => encryptor.decrypt(tampered)).toThrow();
  });
});
