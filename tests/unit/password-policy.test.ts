// @vitest-environment node
import { it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/passwords';
it.each(['Aa1!' + 'x'.repeat(69), 'Aa1!' + 'é'.repeat(35)])(
  'rejects a new password that bcrypt would silently truncate %#',
  async (password) => {
    expect(validatePasswordStrength(password).valid).toBe(false);
    await expect(hashPassword(password)).rejects.toThrow('72');
  },
);
it('accepts the 72-byte boundary and verifies the complete password', async () => {
  const password = 'Aa1!' + 'x'.repeat(68);
  expect(validatePasswordStrength(password).valid).toBe(true);
  const hash = await hashPassword(password);
  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword('Aa1!' + 'x'.repeat(67) + 'y', hash)).toBe(false);
});
it('retains the existing minimum length and character requirements', () => {
  expect(validatePasswordStrength('abcdefgh').errors).toEqual([
    'Password must contain at least one uppercase letter',
    'Password must contain at least one number',
  ]);
  expect(validatePasswordStrength('Ab1').errors).toEqual([
    'Password must be at least 8 characters',
  ]);
});
