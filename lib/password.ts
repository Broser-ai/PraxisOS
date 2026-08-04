import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_SALT_BYTES = 32;
const SCRYPT_HASH_BYTES = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = scryptSync(plain, salt, SCRYPT_HASH_BYTES);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  if (salt.length !== SCRYPT_SALT_BYTES || expected.length !== SCRYPT_HASH_BYTES) {
    return false;
  }
  let candidate: Buffer;
  try {
    candidate = scryptSync(plain, salt, SCRYPT_HASH_BYTES);
  } catch {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}
