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
it('preserves the current six-code-point policy without character-class rules', () => {
  for (const password of ['abcdef', '123456', '😀😀😀😀😀😀'])
    expect(validatePasswordStrength(password)).toEqual({ valid: true, errors: [] });
  for (const password of ['', 'abcde', '😀😀😀😀😀'])
    expect(validatePasswordStrength(password)).toEqual({
      valid: false,
      errors: ['Password must be at least 6 characters'],
    });
});
