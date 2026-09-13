import { timingSafeEqual } from "crypto";
import { compare, hash } from "bcryptjs";

export function isPasswordHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, stored: string) {
  if (isPasswordHash(stored)) return compare(password, stored);
  const left = Buffer.from(password);
  const right = Buffer.from(stored);
  return left.length === right.length && timingSafeEqual(left, right);
}
