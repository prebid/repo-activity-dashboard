// @vitest-environment node
import { beforeEach, it, expect, vi, afterEach } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), snapshot: vi.fn(), headers: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session-transport', () => ({ readVerifiedSession: mocks.read }));
vi.mock('@/lib/auth/server-account-store', () => ({
  getServerAccountStore: () => ({ getAccountSnapshot: mocks.snapshot }),
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error('redirect:' + path);
  },
  notFound: () => {
    throw new Error('not-found');
  },
}));
import { getViewer, requireViewer, failedViewer } from '@/lib/auth/viewer';
import { AuthStateError } from '@/lib/auth/auth-errors';
const user = {
  id: 'u',
  email: 'u@example.test',
  password: 'hash',
  role: 'admin',
  authVersion: 1,
  createdAt: '',
  updatedAt: '',
  mustChangePassword: false,
  temporaryPasswordExpiresAt: '2099-01-01T00:00:00.000Z',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.headers.mockResolvedValue(
    new Headers({ 'x-dashboard-return-path': '/repos/prebidjs?view=issues' }),
  );
  mocks.read.mockResolvedValue({
    user: { id: user.id, email: user.email, authVersion: 1 },
    expires: '2099',
  });
  mocks.snapshot.mockResolvedValue({
    user,
    access: { email: user.email, userId: user.id, isActive: true, role: 'admin' },
  });
});
afterEach(() => vi.unstubAllEnvs());
it('preserves a safe login destination and revalidates role/password-change restrictions', async () => {
  mocks.read.mockResolvedValueOnce(null);
  await expect(requireViewer()).rejects.toThrow(
    'redirect:/auth/login?callbackUrl=%2Frepos%2Fprebidjs%3Fview%3Dissues',
  );
  expect(await requireViewer({ admin: true })).toMatchObject({ id: 'u', role: 'admin' });
  mocks.snapshot.mockResolvedValue({
    user: { ...user, mustChangePassword: true },
    access: { email: user.email, isActive: true, role: 'admin' },
  });
  await expect(requireViewer()).rejects.toThrow(
    'redirect:/auth/change-password?callbackUrl=%2Frepos%2Fprebidjs%3Fview%3Dissues',
  );
  expect(await requireViewer({ allowPasswordChange: true })).toMatchObject({
    mustChangePassword: true,
  });
  mocks.snapshot.mockResolvedValue({
    user,
    access: { email: user.email, isActive: true, role: 'viewer' },
  });
  await expect(requireViewer({ admin: true })).rejects.toThrow('redirect:/repos');
});
it('never turns storage or configuration failures into login redirects', async () => {
  mocks.snapshot.mockRejectedValue(new Error('database offline'));
  await expect(requireViewer()).rejects.toMatchObject({ kind: 'unavailable' });
  mocks.read.mockRejectedValue(new AuthStateError('configuration'));
  expect(await getViewer()).toEqual({ kind: 'configuration' });
});
it('reports malformed records as operator errors and missing/disabled records as denial', async () => {
  mocks.snapshot.mockResolvedValue({
    user: { ...user, role: 'invalid' },
    access: { email: user.email, isActive: true },
  });
  expect(await getViewer()).toEqual({ kind: 'integrity' });
  mocks.snapshot.mockResolvedValue({ user, access: undefined });
  expect(await getViewer()).toEqual({ kind: 'anonymous' });
});
it('checks protected loaders directly instead of depending on their parent layout', async () => {
  mocks.read.mockResolvedValue(null);
  const loaders = await import('@/server/reporting');
  for (const load of [
    () => loaders.allRepositories(),
    () => loaders.contributions('contributors'),
    () => loaders.contributions('companies'),
    () => loaders.repositoryDetail('prebidjs'),
  ])
    await expect(load()).rejects.toThrow('redirect:/auth/login');
});
it('uses only synthetic preview identities and refuses preview administration', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  vi.resetModules();
  const { previewAccounts } = await import('@/lib/presentation/preview');
  const { requireViewer: preview } = await import('@/lib/auth/viewer');
  mocks.read.mockResolvedValue({
    user: { ...previewAccounts[0], authVersion: 0 },
    expires: '2099',
  });
  expect((await preview()).id).toBe(previewAccounts[0].id);
  await expect(preview({ admin: true })).rejects.toThrow('redirect:/repos');
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.read.mockResolvedValue({
    user: { id: 'forged', email: 'other@example.test', authVersion: 0 },
    expires: '2099',
  });
  await expect(preview()).rejects.toThrow('redirect:/auth/login');
});

it('logs only safe diagnostic codes instead of private exception messages or records', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const cause = Object.assign(new Error('secret-canary'), { code: 'EACCES' });
  expect(failedViewer(new AuthStateError('configuration', { cause }))).toEqual({
    kind: 'configuration',
  });
  expect(JSON.stringify(log.mock.calls)).toContain('EACCES');
  expect(JSON.stringify(log.mock.calls)).not.toContain('secret-canary');
});
