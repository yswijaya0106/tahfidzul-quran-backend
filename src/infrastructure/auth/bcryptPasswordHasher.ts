import bcrypt from "bcryptjs";
import { PasswordHasher } from "../../application/auth/ports";

const SALT_ROUNDS = 12;

/**
 * Uses bcryptjs (pure JS, no native build step) so the service runs on any
 * platform without a compiler toolchain. Swap for Argon2id in production if
 * native modules are acceptable in the deployment target.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}
