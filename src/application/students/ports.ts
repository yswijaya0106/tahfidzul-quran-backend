export interface FieldEncryptor {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
}
