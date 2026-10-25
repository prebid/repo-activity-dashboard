// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), headers: vi.fn() }));
vi.mock('@/lib/auth/auth', () => ({ auth: mocks.auth }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error('redirect:' + path);
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.headers.mockResolvedValue(
    new Headers({ 'x-dashboard-return-path': '/repos/prebidjs?view=issues' }),
  );
});
afterEach(() => vi.unstubAllEnvs());
it('preserves the destination for anonymous navigation and enforces forced password changes', async () => {
  const { default: dashboard } = await import('@/app/(dashboard)/layout');
  mocks.auth.mockResolvedValue(null);
  await expect(dashboard({ children: 'content' })).rejects.toThrow(
    'redirect:/auth/login?callbackUrl=%2Frepos%2Fprebidjs%3Fview%3Dissues',
  );
  mocks.auth.mockResolvedValue({ user: { mustChangePassword: true } });
  await expect(dashboard({ children: 'content' })).rejects.toThrow(
    'redirect:/auth/change-password',
  );
  mocks.auth.mockResolvedValue({ user: { mustChangePassword: false } });
  expect(await dashboard({ children: 'content' })).toBe('content');
});
it('allows the admin layout only for real administrator sessions', async () => {
  const { default: admin } = await import('@/app/(dashboard)/admin/layout');
  mocks.auth.mockResolvedValue({ user: { role: 'viewer' } });
  await expect(admin({ children: 'admin content' })).rejects.toThrow('redirect:/repos');
  mocks.auth.mockResolvedValue({ user: { role: 'admin' } });
  expect(await admin({ children: 'admin content' })).toBe('admin content');
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  vi.resetModules();
  const { default: previewAdmin } = await import('@/app/(dashboard)/admin/layout');
  await expect(previewAdmin({ children: 'admin content' })).rejects.toThrow('redirect:/repos');
});
