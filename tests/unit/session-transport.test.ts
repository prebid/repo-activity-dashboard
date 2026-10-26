// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ get: vi.fn(), settings: vi.fn() }));
vi.mock('@/lib/auth/auth', () => ({ rawHandlers: { GET: mocks.get } }));
vi.mock('@/lib/auth/runtime-settings', () => ({ getRuntimeSettings: mocks.settings }));
import {
  parseVerifiedSession,
  readVerifiedSession,
  authOrigin,
} from '@/lib/auth/session-transport';
const session = {
  user: { id: 'u', email: 'u@example.test', authVersion: 1, role: 'admin' },
  expires: '2099',
};
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.settings.mockReturnValue({ authUrl: 'https://dashboard.example.test' });
  mocks.get.mockReset().mockResolvedValue(Response.json(session));
});
afterEach(() => vi.unstubAllEnvs());
it('uses the configured origin and treats token roles as non-authoritative', async () => {
  const result = await readVerifiedSession(
    new Headers({ cookie: 'synthetic-cookie', host: 'untrusted.example.test' }),
  );
  expect(result).toEqual({
    user: { id: 'u', email: 'u@example.test', authVersion: 1 },
    expires: '2099',
  });
  const request = mocks.get.mock.calls[0][0] as Request;
  expect(request.url).toBe('https://dashboard.example.test/api/auth/session');
  expect(request.headers.get('cookie')).toBe('synthetic-cookie');
});
it('refuses malformed or non-OK session responses rather than treating them as truthy users', async () => {
  expect(await parseVerifiedSession(Response.json(null))).toBeNull();
  await expect(
    parseVerifiedSession(Response.json({ error: 'bad' }, { status: 500 })),
  ).rejects.toMatchObject({ kind: 'configuration' });
  await expect(
    parseVerifiedSession(Response.json({ user: { role: 'admin' } })),
  ).rejects.toMatchObject({ kind: 'configuration' });
  mocks.settings.mockReturnValue({});
  expect(() => authOrigin()).toThrow('operator attention');
});
it('does not read production settings for an explicit preview', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  vi.stubEnv('AUTH_URL', 'http://127.0.0.1:3100');
  vi.resetModules();
  const preview = await import('@/lib/auth/session-transport');
  mocks.settings.mockClear();
  expect(preview.authOrigin()).toBe('http://127.0.0.1:3100');
  expect(mocks.settings).not.toHaveBeenCalled();
});
