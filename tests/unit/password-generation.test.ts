// @vitest-environment node
vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));
import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { generateTempPassword } from '@/lib/auth/users';
it('preserves the temporary-password format without using Math.random', () => {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Insecure random source');
  });
  try {
    const password = generateTempPassword();
    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$]+$/);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});
