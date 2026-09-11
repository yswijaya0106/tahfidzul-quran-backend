import crypto from "crypto";
import { FieldEncryptor } from "../../application/students/ports";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

/** Encrypts sensitive fields (e.g. NIK) at rest using AES-256-GCM. */
export class AesFieldEncryptor implements FieldEncryptor {
  private readonly key: Buffer;

  constructor(keyHex: string) {
    this.key = Buffer.from(keyHex, "hex");
    if (this.key.length !== 32) {
      throw new Error("NIK_ENCRYPTION_KEY must be 32 bytes (64 hex characters).");
    }
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
  }

  decrypt(cipherText: string): string {
    const [ivHex, authTagHex, dataHex] = cipherText.split(":");
    if (!ivHex || !authTagHex || !dataHex) {
      throw new Error("Malformed encrypted field value.");
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
