import bcrypt from 'bcryptjs';
import { fitsPasswordByteLimit } from '@/models/password-policy';
export { validatePasswordStrength } from '@/models/password-policy';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  if (!fitsPasswordByteLimit(password)) throw new Error('Password must be at most 72 UTF-8 bytes');
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
